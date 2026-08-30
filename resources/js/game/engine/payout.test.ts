import { describe, it, expect } from 'vitest';
import { settleHand, settleInsurance } from './payout';
import type { Card, Rank } from './card';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });
const hand = (...ranks: Rank[]): Card[] => ranks.map(c);

const base = { bet: 10, blackjackPayout: 1.5 };

describe('settleHand', () => {
    it('pays a natural blackjack at the blackjack rate', () => {
        const r = settleHand({ ...base, player: hand('A', 'K'), dealer: hand('10', '7') });
        expect(r).toEqual({ outcome: 'blackjack', net: 15 });
    });

    it('pushes when both have a natural blackjack', () => {
        const r = settleHand({ ...base, player: hand('A', 'K'), dealer: hand('A', 'Q') });
        expect(r).toEqual({ outcome: 'push', net: 0 });
    });

    it('pays even money for a normal higher total', () => {
        const r = settleHand({ ...base, player: hand('10', '9'), dealer: hand('10', '7') });
        expect(r).toEqual({ outcome: 'win', net: 10 });
    });

    it('loses on a lower total', () => {
        const r = settleHand({ ...base, player: hand('10', '7'), dealer: hand('10', '9') });
        expect(r).toEqual({ outcome: 'lose', net: -10 });
    });

    it('pushes on equal totals', () => {
        const r = settleHand({ ...base, player: hand('10', '7'), dealer: hand('10', '7') });
        expect(r).toEqual({ outcome: 'push', net: 0 });
    });

    it('loses when the player busts', () => {
        const r = settleHand({ ...base, player: hand('10', '10', '5'), dealer: hand('10', '7') });
        expect(r).toEqual({ outcome: 'lose', net: -10 });
    });

    it('wins when the dealer busts and the player did not', () => {
        const r = settleHand({ ...base, player: hand('10', '7'), dealer: hand('10', '6', '10') });
        expect(r).toEqual({ outcome: 'win', net: 10 });
    });

    it('loses to a dealer blackjack', () => {
        const r = settleHand({ ...base, player: hand('10', '9'), dealer: hand('A', 'K') });
        expect(r).toEqual({ outcome: 'lose', net: -10 });
    });

    it('returns half the bet on surrender', () => {
        const r = settleHand({ ...base, player: hand('10', '6'), dealer: hand('10', '7'), surrendered: true });
        expect(r).toEqual({ outcome: 'surrender', net: -5 });
    });

    it('treats a two-card 21 from a split as a normal 21, not a blackjack', () => {
        const r = settleHand({ ...base, player: hand('A', '10'), dealer: hand('10', '7'), fromSplit: true });
        expect(r).toEqual({ outcome: 'win', net: 10 });
    });

    it('loses a split 21 to a dealer natural blackjack', () => {
        const r = settleHand({ ...base, player: hand('A', '10'), dealer: hand('A', 'K'), fromSplit: true });
        expect(r).toEqual({ outcome: 'lose', net: -10 });
    });
});

describe('settleInsurance', () => {
    it('pays 2:1 when the dealer has blackjack', () => {
        expect(settleInsurance(5, true)).toBe(10);
    });

    it('loses the insurance bet when the dealer has no blackjack', () => {
        expect(settleInsurance(5, false)).toBe(-5);
    });
});
