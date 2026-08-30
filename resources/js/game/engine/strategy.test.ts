import { describe, it, expect } from 'vitest';
import { recommend, shouldTakeInsurance, type LegalMoves } from './strategy';
import { STANDARD_RULES } from './rules';
import type { Card, Rank } from './card';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });
const hand = (...ranks: Rank[]): Card[] => ranks.map(c);

const ALL: LegalMoves = { canDouble: true, canSplit: true, canSurrender: true };
const only = (over: Partial<LegalMoves>): LegalMoves => ({ ...ALL, ...over });

/** recommend()'s action for the given player hand vs a dealer upcard. */
const act = (player: Card[], up: Rank, legal: LegalMoves = ALL) =>
    recommend(player, c(up), STANDARD_RULES, legal).action;

describe('recommend — hard totals', () => {
    it('surrenders 16 vs 10, else hits when surrender is off', () => {
        expect(act(hand('10', '6'), '10')).toBe('surrender');
        expect(act(hand('10', '6'), '10', only({ canSurrender: false }))).toBe('hit');
    });

    it('stands 12 vs 6 but hits 12 vs 3', () => {
        expect(act(hand('7', '5'), '6')).toBe('stand');
        expect(act(hand('7', '5'), '3')).toBe('hit');
    });

    it('doubles 11 vs 10, falls back to hit without double', () => {
        expect(act(hand('7', '4'), '10')).toBe('double');
        expect(act(hand('7', '4'), '10', only({ canDouble: false }))).toBe('hit');
    });

    it('doubles 9 vs 3 but hits 9 vs 2', () => {
        expect(act(hand('5', '4'), '3')).toBe('double');
        expect(act(hand('5', '4'), '2')).toBe('hit');
    });

    it('stands on 17+ and hits 8 or lower', () => {
        expect(act(hand('10', '7'), '10')).toBe('stand');
        expect(act(hand('5', '3'), '6')).toBe('hit');
    });
});

describe('recommend — soft totals', () => {
    it('handles soft 18 (A,7)', () => {
        expect(act(hand('A', '7'), '6')).toBe('double');
        expect(act(hand('A', '7'), '8')).toBe('stand');
        expect(act(hand('A', '7'), '9')).toBe('hit');
        expect(act(hand('A', '7'), '6', only({ canDouble: false }))).toBe('stand'); // Ds fallback
    });

    it('doubles A,2 vs 5 but hits A,2 vs 4', () => {
        expect(act(hand('A', '2'), '5')).toBe('double');
        expect(act(hand('A', '2'), '4')).toBe('hit');
    });

    it('stands A,8', () => {
        expect(act(hand('A', '8'), '6')).toBe('stand');
    });
});

describe('recommend — pairs', () => {
    it('always splits 8s, else surrender/hit vs 10', () => {
        expect(act(hand('8', '8'), 'A')).toBe('split');
        expect(act(hand('8', '8'), '10', only({ canSplit: false }))).toBe('surrender');
        expect(act(hand('8', '8'), '10', only({ canSplit: false, canSurrender: false }))).toBe('hit');
    });

    it('handles 9,9 (stand vs 7 and A, split vs 6)', () => {
        expect(act(hand('9', '9'), '7')).toBe('stand');
        expect(act(hand('9', '9'), 'A')).toBe('stand');
        expect(act(hand('9', '9'), '6')).toBe('split');
    });

    it('never splits 5s or 10s', () => {
        expect(act(hand('5', '5'), '6')).toBe('double');
        expect(act(hand('10', '10'), '6')).toBe('stand');
        expect(act(hand('K', 'Q'), '6')).toBe('stand'); // ten-value pair via rankValue
    });

    it('always splits aces, else hits', () => {
        expect(act(hand('A', 'A'), '8')).toBe('split');
        expect(act(hand('A', 'A'), '8', only({ canSplit: false }))).toBe('hit');
    });
});

describe('recommend — multi-card hands', () => {
    it('reads hard totals from 3+ cards', () => {
        expect(act(hand('10', '4', '2'), '9')).toBe('surrender'); // hard 16 vs 9
        expect(act(hand('10', '4', '2'), '9', only({ canSurrender: false }))).toBe('hit');
    });

    it('reads soft totals from 3+ cards (no double after 3 cards)', () => {
        expect(act(hand('A', '2', '4'), '4', only({ canDouble: false }))).toBe('hit'); // soft 17 vs 4
    });
});

describe('insurance', () => {
    it('never takes insurance', () => {
        expect(shouldTakeInsurance()).toBe(false);
    });
});

describe('reasons explain the circumstance', () => {
    const rec = (player: Card[], up: Rank, legal: LegalMoves = ALL) =>
        recommend(player, c(up), STANDARD_RULES, legal);

    it('teaches never to split tens', () => {
        const r = rec(hand('J', 'J'), '4');
        expect(r.action).toBe('stand');
        expect(r.reason).toMatch(/never split tens/i);
    });

    it('explains a stiff total by the dealer upcard, not as a blanket rule', () => {
        const standing = rec(hand('10', '5'), '3'); // 15 vs 3
        expect(standing.action).toBe('stand');
        expect(standing.reason).toMatch(/bust/i);        // explains the dealer's weakness
        expect(standing.reason).toMatch(/2 or 3/);       // names which upcards

        const hitting = rec(hand('10', '5'), '8'); // 15 vs 8
        expect(hitting.action).toBe('hit');
        expect(hitting.reason).toMatch(/17/); // dealer will likely reach 17+
    });

    it('says why a would-be double became a hit', () => {
        const r = rec(hand('7', '4'), '10', only({ canDouble: false })); // 11, can't double
        expect(r.action).toBe('hit');
        expect(r.reason).toMatch(/doubl/i);       // explains the double it couldn't make
        expect(r.reason).toMatch(/hit instead/i); // and what to do instead
    });
});
