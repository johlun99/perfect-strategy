import type { Card } from './card';
import { RANKS, SUITS } from './card';
import type { Rng } from './rng';

/** Anything the game can draw cards from. Lets tests inject a rigged deck. */
export interface CardSource {
    draw(): Card;
    needsShuffle(): boolean;
    reshuffle(): void;
}

/** A fresh, ordered N-deck set of cards. */
export function buildShoe(numDecks: number): Card[] {
    const cards: Card[] = [];
    for (let d = 0; d < numDecks; d++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                cards.push({ rank, suit });
            }
        }
    }
    return cards;
}

/** In-place Fisher–Yates shuffle driven by an injected RNG. */
function shuffleInPlace(cards: Card[], rng: Rng): void {
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
}

/**
 * A dealing shoe of N decks. Cards are drawn from the front; once dealing
 * passes the penetration threshold the shoe asks to be reshuffled.
 */
export class Shoe {
    private cards: Card[] = [];
    private pos = 0;

    constructor(
        private readonly numDecks: number,
        private readonly rng: Rng,
        private readonly penetration = 0.75,
    ) {
        this.reshuffle();
    }

    draw(): Card {
        if (this.pos >= this.cards.length) {
            throw new Error('Shoe is empty');
        }
        return this.cards[this.pos++];
    }

    get remaining(): number {
        return this.cards.length - this.pos;
    }

    needsShuffle(): boolean {
        return this.pos >= this.cards.length * this.penetration;
    }

    reshuffle(): void {
        this.cards = buildShoe(this.numDecks);
        shuffleInPlace(this.cards, this.rng);
        this.pos = 0;
    }
}
