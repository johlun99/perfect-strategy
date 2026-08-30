export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type Rank =
    | 'A' | '2' | '3' | '4' | '5' | '6'
    | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    rank: Rank;
    suit: Suit;
}

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
export const RANKS: readonly Rank[] = [
    'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

/** Base blackjack value of a rank: faces are 10, an ace is 11 (soft). */
export function rankValue(rank: Rank): number {
    if (rank === 'A') return 11;
    if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
    return Number(rank);
}
