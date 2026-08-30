import type { Card } from './card';
import { rankValue } from './card';

export interface HandValue {
    total: number;
    /** True when an ace is still counted as 11 (i.e. the total can't be improved). */
    soft: boolean;
}

/**
 * Best blackjack total for a set of cards. Aces count as 11 until that would
 * bust, then each is demoted to 1. `soft` reports whether an ace remains at 11.
 */
export function handValue(cards: Card[]): HandValue {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
        total += rankValue(card.rank);
        if (card.rank === 'A') aces++;
    }

    while (total > 21 && aces > 0) {
        total -= 10; // demote one ace from 11 to 1
        aces--;
    }

    return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
    return handValue(cards).total > 21;
}
