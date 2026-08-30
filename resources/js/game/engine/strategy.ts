import type { Card } from './card';
import { rankValue } from './card';
import { handValue } from './hand';
import type { Ruleset } from './rules';

export type StrategyAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface LegalMoves {
    canDouble: boolean;
    canSplit: boolean;
    canSurrender: boolean;
}

export interface Recommendation {
    /** The best move that is actually legal right now. */
    action: StrategyAction;
    /** The textbook move before legality fallback (e.g. 'double' even when you can't). */
    ideal: StrategyAction;
    /** Short human "why", for the hint, chart and mistake log. */
    reason: string;
}

export const INSURANCE_REASON =
    'Insurance is a losing side bet long-term — basic strategy always declines.';

/** Basic strategy never takes insurance or even money. */
export function shouldTakeInsurance(): boolean {
    return false;
}

/**
 * Cell codes. `Dh`/`Ds` = double, else hit/stand. `Rh` = surrender, else hit.
 * `P` = split, else fall through to the hard/soft lookup.
 */
type Code = 'H' | 'S' | 'Dh' | 'Ds' | 'Rh' | 'P';

/** Dealer upcard columns (Ace = 11), via rankValue. */
const COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

// Standard 6-deck, dealer stands soft 17, DAS on, late surrender.
// Rows are indexed by hand total (hard/soft) or pair rank value.

const HARD: Record<number, Code[]> = {
    8:  ['H', 'H',  'H',  'H',  'H',  'H', 'H', 'H',  'H',  'H'],
    9:  ['H', 'Dh', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H',  'H',  'H'],
    10: ['Dh','Dh', 'Dh', 'Dh', 'Dh', 'Dh','Dh','Dh', 'H',  'H'],
    11: ['Dh','Dh', 'Dh', 'Dh', 'Dh', 'Dh','Dh','Dh', 'Dh', 'H'],
    12: ['H', 'H',  'S',  'S',  'S',  'H', 'H', 'H',  'H',  'H'],
    13: ['S', 'S',  'S',  'S',  'S',  'H', 'H', 'H',  'H',  'H'],
    14: ['S', 'S',  'S',  'S',  'S',  'H', 'H', 'H',  'H',  'H'],
    15: ['S', 'S',  'S',  'S',  'S',  'H', 'H', 'H',  'Rh', 'H'],
    16: ['S', 'S',  'S',  'S',  'S',  'H', 'H', 'Rh', 'Rh', 'Rh'],
    17: ['S', 'S',  'S',  'S',  'S',  'S', 'S', 'S',  'S',  'S'],
};

const SOFT: Record<number, Code[]> = {
    13: ['H', 'H',  'H',  'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'], // A,2
    14: ['H', 'H',  'H',  'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'], // A,3
    15: ['H', 'H',  'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'], // A,4
    16: ['H', 'H',  'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'], // A,5
    17: ['H', 'Dh', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'], // A,6
    18: ['Ds','Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'], // A,7
    19: ['S', 'S',  'S',  'S',  'S',  'S', 'S', 'S', 'S', 'S'], // A,8
    20: ['S', 'S',  'S',  'S',  'S',  'S', 'S', 'S', 'S', 'S'], // A,9
};

const PAIRS: Record<number, Code[]> = {
    2:  ['P', 'P',  'P',  'P',  'P',  'P', 'H', 'H', 'H', 'H'],
    3:  ['P', 'P',  'P',  'P',  'P',  'P', 'H', 'H', 'H', 'H'],
    4:  ['H', 'H',  'H',  'P',  'P',  'H', 'H', 'H', 'H', 'H'],
    5:  ['Dh','Dh', 'Dh', 'Dh', 'Dh', 'Dh','Dh','Dh','H', 'H'], // never split; play as hard 10
    6:  ['P', 'P',  'P',  'P',  'P',  'H', 'H', 'H', 'H', 'H'],
    7:  ['P', 'P',  'P',  'P',  'P',  'P', 'H', 'H', 'H', 'H'],
    8:  ['P', 'P',  'P',  'P',  'P',  'P', 'P', 'P', 'P', 'P'],
    9:  ['P', 'P',  'P',  'P',  'P',  'S', 'P', 'P', 'S', 'S'],
    10: ['S', 'S',  'S',  'S',  'S',  'S', 'S', 'S', 'S', 'S'], // never split
    11: ['P', 'P',  'P',  'P',  'P',  'P', 'P', 'P', 'P', 'P'], // aces
};

let warnedS17 = false;

export function recommend(
    player: Card[],
    dealerUp: Card,
    rules: Ruleset,
    legal: LegalMoves,
): Recommendation {
    // Tables are built for a dealer who stands on soft 17. Warn (once) if the
    // ruleset ever changes so we don't silently mis-coach.
    if (rules.dealerHitsSoft17 && !warnedS17) {
        warnedS17 = true;
        console.warn('strategy tables assume dealer stands on soft 17; recommendations may be off');
    }

    const hv = handValue(player);
    const up = rankValue(dealerUp.rank);
    const col = COLS.indexOf(up as (typeof COLS)[number]);

    // Pairs — only for a fresh two-card hand of matching rank value.
    const isPair = player.length === 2 && rankValue(player[0].rank) === rankValue(player[1].rank);
    if (isPair) {
        const pairRank = rankValue(player[0].rank);
        const code = PAIRS[pairRank][col];
        if (code === 'P') {
            if (legal.canSplit) return finalize('split', 'split', hv, up, pairRank);
            // Can't split (max hands / no funds): fall through to hard/soft.
        } else {
            return resolve(code, legal, hv, up, pairRank);
        }
    }

    // Soft totals (an ace still counts 11).
    if (hv.soft) {
        if (hv.total >= 21) return finalize('stand', 'stand', hv, up);
        if (hv.total >= 13) return resolve(SOFT[hv.total][col], legal, hv, up);
        return finalize('hit', 'hit', hv, up); // soft 12 (e.g. unsplittable A,A)
    }

    // Hard totals.
    if (hv.total <= 8) return finalize('hit', 'hit', hv, up);
    if (hv.total >= 17) return finalize('stand', 'stand', hv, up);
    return resolve(HARD[hv.total][col], legal, hv, up);
}

/** Turn a table code into a legal action, keeping the textbook `ideal`. */
function resolve(
    code: Code,
    legal: LegalMoves,
    hv: { total: number; soft: boolean },
    up: number,
    pairRank?: number,
): Recommendation {
    switch (code) {
        case 'H': return finalize('hit', 'hit', hv, up, pairRank);
        case 'S': return finalize('stand', 'stand', hv, up, pairRank);
        case 'Dh': return finalize(legal.canDouble ? 'double' : 'hit', 'double', hv, up, pairRank);
        case 'Ds': return finalize(legal.canDouble ? 'double' : 'stand', 'double', hv, up, pairRank);
        case 'Rh': return finalize(legal.canSurrender ? 'surrender' : 'hit', 'surrender', hv, up, pairRank);
        case 'P': return finalize('split', 'split', hv, up, pairRank);
    }
}

function finalize(
    action: StrategyAction,
    ideal: StrategyAction,
    hv: { total: number; soft: boolean },
    up: number,
    pairRank?: number,
): Recommendation {
    return { action, ideal, reason: reasonFor(action, ideal, hv, up, pairRank) };
}

/**
 * A short, teachable "why" for each recommendation. Reasons name the condition
 * (dealer upcard strength, hand category) rather than asserting a blanket rule,
 * so the player learns *when* a play applies — not just what to click here.
 */
function reasonFor(
    action: StrategyAction,
    ideal: StrategyAction,
    hv: { total: number; soft: boolean },
    up: number,
    pairRank?: number,
): string {
    const upLabel = up === 11 ? 'an Ace' : `a ${up}`;
    // Stiff = a hard 12–16: likely to bust on a hit, too low to be safe standing.
    const stiff = !hv.soft && hv.total >= 12 && hv.total <= 16;
    // Names *which* upcards make the dealer weak (only used when up is 2–6).
    const dealerBust = up >= 4 && up <= 6
        ? `${upLabel} is one of the dealer's weakest upcards — showing a 4, 5 or 6 they bust roughly 40% of the time`
        : `${upLabel} is a weak upcard — the dealer still busts about a third of the time showing a 2 or 3`;

    // The textbook play was downgraded because it isn't legal right now.
    if (ideal !== action) {
        if (ideal === 'double' && action === 'hit') {
            return `The textbook play is to double, but doubling is only offered on your first two cards (and needs chips to match your bet). You can't here, so take a normal hit instead.`;
        }
        if (ideal === 'double' && action === 'stand') {
            return `You'd normally double this hand, but doubling isn't available now — so stand, the better of the moves left to you.`;
        }
        if (ideal === 'surrender' && action === 'hit') {
            return `The best play is to surrender (forfeit the hand to get half your bet back), but this spot doesn't allow it — so hit, the next-best option.`;
        }
    }

    switch (action) {
        case 'split':
            if (pairRank === 11) return `Always split aces. Kept together they make a soft 12 that goes nowhere; split, each ace starts its own hand — two strong chances at 21.`;
            if (pairRank === 8) return `Always split 8s. A hard 16 is the worst hand in blackjack, so break it up: each hand now starts on 8, far more promising even against a strong dealer.`;
            return `Split this pair. The odds favour playing each card as the start of its own hand — you put out a second bet, but you're better off with two hands than one clumsy total.`;

        case 'double':
            if (pairRank === 5) return `Never split 5s. A pair of 5s is really a 10 — a great total to build on. Double instead: take exactly one card for double the bet.`;
            if (hv.total === 11) return `Double down on 11. One card can't bust you, and nearly a third of the deck is ten-valued, so you'll often land 20 or 21 — well worth doubling your bet.`;
            if (hv.total === 10) return `Double down on 10. One more card usually makes 19 or 20, and you hold the edge over ${upLabel} — so put more money out for that single card.`;
            if (hv.soft) return `Double down. With a soft ${hv.total} the next card can't bust you (the ace simply drops from 11 to 1), and ${dealerBust} — so it's worth doubling your bet to press that edge.`;
            return `Double down on ${hv.total}. It's a strong hand to draw to, and ${dealerBust}. When the dealer is this likely to go over 21, put more money out for one card.`;

        case 'surrender':
            return `Surrender. A hard ${hv.total} against ${upLabel} loses more than half the time, so on average you'd lose your whole bet. Forfeiting to keep half your bet loses less over the long run.`;

        case 'stand':
            if (pairRank === 10) return `Never split tens. A pair of tens is 20 — one of the strongest hands there is. Splitting throws away a near-certain winner to chase two weaker hands. Just stand.`;
            if (pairRank === 9) return `Stand on 18. Splitting 9s here would only build two weaker hands — your 18 already beats the 17 the dealer most often makes showing ${upLabel}.`;
            if (stiff) return `Stand. Your ${hv.total} is a "stiff" — a hard 12–16 that busts on any ten and most other cards. But ${dealerBust}, so the odds favour making the dealer draw and risk going over, rather than risking it yourself.`;
            if (hv.soft) return `Stand. A soft ${hv.total} is already a strong hand; drawing would more likely weaken it than help, so keep it.`;
            return `Stand. At ${hv.total} the chance of improving is tiny and another card would usually bust you — hold what you have.`;

        case 'hit':
            if (pairRank !== undefined) return `Don't split this pair against ${upLabel} — you'd only turn one playable hand into two weak ones. Take a card and try to improve the hand you have.`;
            if (hv.total <= 8) return `Hit. At ${hv.total} no single card can bust you, so always take a free card to build toward a stronger total.`;
            if (hv.total === 12 && (up === 2 || up === 3)) return `Hit. A 12 only busts if you draw a ten, and with ${upLabel} showing the dealer doesn't bust often enough to make standing worthwhile — so take one card.`;
            if (stiff) return `Hit. Your ${hv.total} is a "stiff" (a hard 12–16). It would lose if you stand, because the dealer rarely busts showing 7 through Ace — with ${upLabel} they'll usually reach 17 or more. Drawing risks a bust, but improving is your only real shot at winning.`;
            if (hv.soft) return `Hit. With a soft ${hv.total} the next card can't bust you (the ace drops from 11 to 1 if needed), so it's a free chance to improve toward a stronger total.`;
            return `Hit. ${hv.total} isn't strong enough to stand on against ${upLabel}, and it's too high to double — so take another card.`;
    }
}

/** The raw strategy tables, exported so the UI chart can't drift from the engine. */
export const TABLES = { HARD, SOFT, PAIRS, COLS };
