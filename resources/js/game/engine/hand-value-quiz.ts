import type { Card } from './card';
import { rankValue } from './card';
import type { CardSource } from './shoe';
import type { Rng } from './rng';
import { handValue, type HandValue } from './hand';

export interface Option {
    label: string;
    correct: boolean;
}

/**
 * Display label for a hand value: soft hands show both readings, e.g. `8/18`.
 * A soft 21 (blackjack or any soft 21) reads as just `21` — nobody calls it 11.
 */
export function formatValue(hv: HandValue): string {
    return hv.soft && hv.total !== 21 ? `${hv.total - 10}/${hv.total}` : String(hv.total);
}

/** A soft total (12–21) rendered as its two readings, e.g. 18 -> `8/18`. */
function softLabel(total: number): string {
    return `${total - 10}/${total}`;
}

/** In-place Fisher–Yates shuffle (same pattern as shoe.ts). */
function shuffle<T>(items: T[], rng: Rng): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

/**
 * Four answer options for a hand — one correct, three plausible wrongs.
 * Distractors are near-misses of the real total; a soft hand also always offers
 * the tempting "hard only" misread (e.g. `18` next to the correct `8/18`).
 */
export function buildOptions(cards: Card[], rng: Rng): Option[] {
    const hv = handValue(cards);
    const correct = formatValue(hv);
    const wrong: string[] = [];

    // Ace trap: offer the hard-total misread for a soft hand (unless that's
    // already the correct label, as with a soft 21).
    if (hv.soft && String(hv.total) !== correct) wrong.push(String(hv.total));

    const pool = hv.soft
        ? [-2, -1, 1, 2].map((d) => hv.total + d).filter((t) => t >= 12 && t <= 21).map(softLabel)
        : [-2, -1, 1, 2].map((d) => hv.total + d).filter((t) => t >= 4 && t <= 30).map(String);

    for (const label of shuffle(pool, rng)) {
        if (wrong.length >= 3) break;
        if (label !== correct && !wrong.includes(label)) wrong.push(label);
    }

    // Fallback for the rare short pool: random plausible hard totals.
    for (let t = 5; wrong.length < 3 && t <= 26; t++) {
        const label = String(t);
        if (label !== correct && !wrong.includes(label)) wrong.push(label);
    }

    const options: Option[] = [
        { label: correct, correct: true },
        ...wrong.slice(0, 3).map((label) => ({ label, correct: false })),
    ];
    return shuffle(options, rng);
}

/**
 * Deal a hand from the source, reshuffling when it asks. With `count` set, draws
 * exactly that many cards; otherwise a random 2–5 ("mix").
 */
export function dealHand(source: CardSource, rng: Rng, count?: number): Card[] {
    if (source.needsShuffle()) source.reshuffle();
    const n = count ?? 2 + Math.floor(rng() * 4); // exact size, or a 2–5 mix
    const cards: Card[] = [];
    for (let i = 0; i < n; i++) cards.push(source.draw());
    return cards;
}

/**
 * Step-by-step "chunk into tens" breakdown for totaling a hand in your head —
 * the guide shown to a dealer-in-training after a miss. Tens first, then pairs
 * of small cards that make ten, then leftovers, and the ace(s) last.
 */
export function explainHand(cards: Card[]): string[] {
    const steps: string[] = [];
    let running = 0;

    const tens = cards.filter((c) => rankValue(c.rank) === 10);
    const aces = cards.filter((c) => c.rank === 'A');
    const smalls = cards
        .filter((c) => c.rank !== 'A' && rankValue(c.rank) < 10)
        .map((c) => Number(c.rank))
        .sort((a, b) => a - b);

    if (tens.length) {
        running += 10 * tens.length;
        steps.push(`Tens: ${tens.map((c) => c.rank).join(' + ')} = ${running}.`);
    }

    // Pair small cards that sum to 10; whatever can't pair is a leftover.
    const pairs: Array<[number, number]> = [];
    const leftovers: number[] = [];
    let i = 0;
    let j = smalls.length - 1;
    while (i < j) {
        const sum = smalls[i] + smalls[j];
        if (sum === 10) { pairs.push([smalls[i], smalls[j]]); i++; j--; }
        else if (sum < 10) { leftovers.push(smalls[i]); i++; }
        else { leftovers.push(smalls[j]); j--; }
    }
    if (i === j) leftovers.push(smalls[i]);

    for (const [a, b] of pairs) {
        running += 10;
        steps.push(`${a} + ${b} = 10 → ${running}.`);
    }
    for (const v of leftovers) {
        running += v;
        steps.push(`Add ${v} → ${running}.`);
    }

    if (aces.length) {
        const low = running + aces.length; // every ace as 1
        const canBeHigh = low + 10 <= 21;  // one ace can still be 11
        if (aces.length > 1) {
            steps.push(canBeHigh
                ? `Aces: 1 each → ${low}, and one can be 11 → ${low + 10}.`
                : `Aces: 11 would bust, so 1 each → ${low}.`);
        } else {
            steps.push(canBeHigh
                ? `Ace: 11 fits → ${low + 10} (or as 1 → ${low}).`
                : `Ace: 11 would bust, so count it as 1 → ${low}.`);
        }
    }

    const hv = handValue(cards);
    steps.push(`Total: ${formatValue(hv)}${hv.total > 21 ? ' — busted' : ''}.`);
    return steps;
}
