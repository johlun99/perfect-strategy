import { describe, it, expect } from 'vitest';
import type { Card, Rank } from './card';
import { handValue, isBlackjack, isBust } from './hand';

// Test helper: rank is all that matters for valuation; suit is arbitrary.
const c = (rank: Rank): Card => ({ rank, suit: 'spades' });
const hand = (...ranks: Rank[]): Card[] => ranks.map(c);

describe('handValue', () => {
    it('sums plain number and face cards as a hard total', () => {
        expect(handValue(hand('10', '7'))).toEqual({ total: 17, soft: false });
        expect(handValue(hand('K', 'Q'))).toEqual({ total: 20, soft: false });
        expect(handValue(hand('2', '3', '4'))).toEqual({ total: 9, soft: false });
    });

    it('counts an ace as 11 (soft) when it does not bust', () => {
        expect(handValue(hand('A', '6'))).toEqual({ total: 17, soft: true });
        expect(handValue(hand('A', 'K'))).toEqual({ total: 21, soft: true });
    });

    it('demotes an ace to 1 (hard) when 11 would bust', () => {
        expect(handValue(hand('A', '6', '10'))).toEqual({ total: 17, soft: false });
        expect(handValue(hand('A', 'A'))).toEqual({ total: 12, soft: true });
        expect(handValue(hand('A', 'A', '9'))).toEqual({ total: 21, soft: true });
        expect(handValue(hand('A', 'A', 'K', '9'))).toEqual({ total: 21, soft: false });
    });

    it('reports a busted total', () => {
        expect(handValue(hand('10', '10', '5'))).toEqual({ total: 25, soft: false });
    });
});

describe('isBlackjack', () => {
    it('is true only for a two-card 21', () => {
        expect(isBlackjack(hand('A', 'K'))).toBe(true);
        expect(isBlackjack(hand('A', '10'))).toBe(true);
    });

    it('is false for 21 made of three or more cards', () => {
        expect(isBlackjack(hand('7', '7', '7'))).toBe(false);
        expect(isBlackjack(hand('A', '5', '5'))).toBe(false);
    });

    it('is false for a non-21 two-card hand', () => {
        expect(isBlackjack(hand('10', '7'))).toBe(false);
    });
});

describe('isBust', () => {
    it('is true above 21 and false at or below', () => {
        expect(isBust(hand('10', '10', '5'))).toBe(true);
        expect(isBust(hand('10', '10'))).toBe(false);
        expect(isBust(hand('A', 'A'))).toBe(false);
    });
});
