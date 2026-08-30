import type { Ruleset } from './rules';

/**
 * A deterministic, infinite-deck expected-value solver used to *generate* basic
 * strategy tables for a given ruleset. It exists because Cherry's "dealer wins
 * pushes on 17/18/19" rule has no published chart — the optimal play has to be
 * computed. Card draws are modelled as independent with rank probabilities
 * 1/13 (each of 2–9 and the ace) and 4/13 (ten-values). Splitting EV uses the
 * standard approximation (twice the EV of one post-split hand, no further
 * resplit); the dealer is assumed to have already peeked for a natural.
 */

export type Code = 'H' | 'S' | 'Dh' | 'Ds' | 'Rh' | 'P';

export interface StrategyTables {
    HARD: Record<number, Code[]>;
    SOFT: Record<number, Code[]>;
    PAIRS: Record<number, Code[]>;
    COLS: readonly number[];
}

interface CardCat {
    v: number; // blackjack value: ten-values 10, ace 11
    p: number;
    ace: boolean;
}

const ACE: CardCat = { v: 11, p: 1 / 13, ace: true };
const TEN: CardCat = { v: 10, p: 4 / 13, ace: false };
const DRAWS: CardCat[] = [
    ...[2, 3, 4, 5, 6, 7, 8, 9].map((v) => ({ v, p: 1 / 13, ace: false })),
    TEN,
    ACE,
];

function catFor(value: number): CardCat {
    if (value === 11) return ACE;
    if (value === 10) return TEN;
    return { v: value, p: 1 / 13, ace: false };
}

/** A hand as its all-aces-low sum plus the ace count, which is loss-free to reason about. */
interface HS {
    hard: number;
    aces: number;
}

const EMPTY: HS = { hard: 0, aces: 0 };

function add(hs: HS, cat: CardCat): HS {
    return cat.ace
        ? { hard: hs.hard + 1, aces: hs.aces + 1 }
        : { hard: hs.hard + cat.v, aces: hs.aces };
}

/** Best total ≤ 21, promoting one ace to 11 when it fits. */
function best(hs: HS): { total: number; soft: boolean } {
    if (hs.aces > 0 && hs.hard + 10 <= 21) return { total: hs.hard + 10, soft: true };
    return { total: hs.hard, soft: false };
}

const isBust = (hs: HS): boolean => hs.hard > 21;
const key = (hs: HS): string => `${hs.hard}:${hs.aces}`;

/** Bust is stored under total 0. Other keys are dealer final totals 17–21. */
type Dist = Map<number, number>;

function dealerDistribution(upValue: number, rules: Ruleset): Dist {
    const upCat = catFor(upValue);
    const memo = new Map<string, Dist>();

    function from(hs: HS): Dist {
        if (isBust(hs)) return new Map([[0, 1]]);
        const { total, soft } = best(hs);
        const mustHit = total < 17 || (total === 17 && soft && rules.dealerHitsSoft17);
        if (!mustHit) return new Map([[total, 1]]);

        const k = key(hs);
        const cached = memo.get(k);
        if (cached) return cached;

        const dist: Dist = new Map();
        for (const cat of DRAWS) {
            for (const [outcome, prob] of from(add(hs, cat))) {
                dist.set(outcome, (dist.get(outcome) ?? 0) + cat.p * prob);
            }
        }
        memo.set(k, dist);
        return dist;
    }

    // Draw the hole card, conditioned on the dealer NOT having a natural (peek).
    const up = add(EMPTY, upCat);
    const dist: Dist = new Map();
    let norm = 0;
    for (const hole of DRAWS) {
        if (best(add(up, hole)).total === 21) continue; // dealer blackjack — excluded by peek
        norm += hole.p;
        for (const [outcome, prob] of from(add(up, hole))) {
            dist.set(outcome, (dist.get(outcome) ?? 0) + hole.p * prob);
        }
    }
    for (const [o, p] of dist) dist.set(o, p / norm);
    return dist;
}

function standEV(hs: HS, dist: Dist, rules: Ruleset): number {
    if (isBust(hs)) return -1;
    const pt = best(hs).total;
    let ev = 0;
    for (const [outcome, prob] of dist) {
        if (outcome === 0) ev += prob; // dealer bust -> win
        else if (pt > outcome) ev += prob;
        else if (pt < outcome) ev -= prob;
        else if (rules.dealerWinsLowTies && outcome >= 17 && outcome <= 19) ev -= prob; // Cherry tie loss
        // otherwise a push -> +0
    }
    return ev;
}

function canDoubleTotal(hs: HS, rules: Ruleset): boolean {
    if (rules.doubleTotals === null) return true;
    const { total, soft } = best(hs);
    return rules.doubleTotals.includes(soft ? total - 10 : total); // ace as 1
}

/** Optimal EV playing only stand/hit from here on (no double/split after the first move). */
function makePlay(dist: Dist, rules: Ruleset): (hs: HS) => number {
    const memo = new Map<string, number>();
    function play(hs: HS): number {
        if (isBust(hs)) return -1;
        const k = key(hs);
        const cached = memo.get(k);
        if (cached !== undefined) return cached;
        let hit = 0;
        for (const cat of DRAWS) hit += cat.p * play(add(hs, cat));
        const v = Math.max(standEV(hs, dist, rules), hit);
        memo.set(k, v);
        return v;
    }
    return play;
}

function doubleEV(hs: HS, dist: Dist, rules: Ruleset): number {
    let ev = 0;
    for (const cat of DRAWS) {
        const nhs = add(hs, cat);
        ev += cat.p * (isBust(nhs) ? -2 : 2 * standEV(nhs, dist, rules));
    }
    return ev;
}

function splitEV(pairCat: CardCat, dist: Dist, rules: Ruleset, play: (hs: HS) => number): number {
    const start = add(EMPTY, pairCat);
    let per = 0;
    for (const cat of DRAWS) {
        const nhs = add(start, cat);
        let ev: number;
        if (pairCat.ace && rules.splitAcesOneCard) {
            ev = isBust(nhs) ? -1 : standEV(nhs, dist, rules); // one card only, must stand
        } else {
            ev = play(nhs); // optimal stand/hit
            if (rules.doubleAfterSplit && canDoubleTotal(nhs, rules)) {
                ev = Math.max(ev, doubleEV(nhs, dist, rules));
            }
        }
        per += cat.p * ev;
    }
    return 2 * per;
}

/** Build the full strategy table (hard, soft, pairs) for a ruleset by EV. */
export function generateTables(rules: Ruleset): StrategyTables {
    const COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
    const HARD: Record<number, Code[]> = {};
    const SOFT: Record<number, Code[]> = {};
    const PAIRS: Record<number, Code[]> = {};

    COLS.forEach((up, i) => {
        const dist = dealerDistribution(up, rules);
        const play = makePlay(dist, rules);
        const hitEV = (hs: HS): number => {
            let e = 0;
            for (const cat of DRAWS) e += cat.p * play(add(hs, cat));
            return e;
        };

        const cell = (
            hs: HS,
            opts: { pairCat?: CardCat; allowSurrender?: boolean } = {},
        ): Code => {
            const s = standEV(hs, dist, rules);
            const h = hitEV(hs);
            let code: Code = h > s ? 'H' : 'S';
            let bestEV = Math.max(s, h);

            if (canDoubleTotal(hs, rules)) {
                const d = doubleEV(hs, dist, rules);
                if (d > bestEV) { code = h >= s ? 'Dh' : 'Ds'; bestEV = d; }
            }
            if (rules.surrenderAllowed && opts.allowSurrender && -0.5 > bestEV) {
                code = 'Rh'; bestEV = -0.5;
            }
            if (opts.pairCat) {
                const p = splitEV(opts.pairCat, dist, rules, play);
                if (p > bestEV) { code = 'P'; bestEV = p; }
            }
            return code;
        };

        // Match the authored chart's displayed rows (8–17); recommend() only consults 9–16.
        for (let t = 8; t <= 17; t++) (HARD[t] ??= [])[i] = cell({ hard: t, aces: 0 }, { allowSurrender: true });
        for (let t = 13; t <= 20; t++) (SOFT[t] ??= [])[i] = cell({ hard: t - 10, aces: 1 }, { allowSurrender: true });
        for (const pr of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
            const pc = catFor(pr);
            (PAIRS[pr] ??= [])[i] = cell(add(add(EMPTY, pc), pc), { pairCat: pc });
        }
    });

    return { HARD, SOFT, PAIRS, COLS };
}
