import { describe, it, expect } from 'vitest';
import type { Card, Rank } from './card';
import type { CardSource } from './shoe';
import { createRng } from './rng';
import { handValue } from './hand';
import { formatValue, buildOptions, dealHand, explainHand } from './hand-value-quiz';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });

describe('formatValue', () => {
    it('formats a hard total as a plain number', () => {
        expect(formatValue(handValue([c('10'), c('8')]))).toBe('18');
    });

    it('formats a soft total as both readings', () => {
        expect(formatValue(handValue([c('A'), c('7')]))).toBe('8/18');
    });

    it('formats a bust as a plain number', () => {
        expect(formatValue(handValue([c('K'), c('Q'), c('5')]))).toBe('25');
    });

    it('formats a two-card blackjack (A+K) as 21, not 11/21', () => {
        expect(formatValue(handValue([c('A'), c('K')]))).toBe('21');
    });

    it('formats a multi-card soft 21 as 21', () => {
        expect(formatValue(handValue([c('A'), c('4'), c('6')]))).toBe('21');
    });
});

describe('buildOptions', () => {
    it('includes exactly one correct option matching formatValue', () => {
        const cards = [c('10'), c('8')];
        const opts = buildOptions(cards, createRng(1));
        const correct = opts.filter((o) => o.correct);
        expect(correct).toHaveLength(1);
        expect(correct[0].label).toBe(formatValue(handValue(cards)));
    });

    it('returns four options with distinct labels', () => {
        const opts = buildOptions([c('10'), c('8')], createRng(3));
        expect(opts).toHaveLength(4);
        expect(new Set(opts.map((o) => o.label)).size).toBe(4);
    });

    it('offers the hard-total ace trap for a soft hand', () => {
        const cards = [c('A'), c('7')]; // soft 18 -> correct "8/18"
        const opts = buildOptions(cards, createRng(2));
        const labels = opts.map((o) => o.label);
        expect(labels).toContain('8/18');
        expect(labels).toContain('18'); // the tempting hard misread
        expect(opts.find((o) => o.label === '18')!.correct).toBe(false);
    });

    it('treats a blackjack as 21, with no duplicate 21 option', () => {
        const cards = [c('A'), c('K')];
        const opts = buildOptions(cards, createRng(5));
        expect(opts).toHaveLength(4);
        expect(new Set(opts.map((o) => o.label)).size).toBe(4);
        const correct = opts.filter((o) => o.correct);
        expect(correct).toHaveLength(1);
        expect(correct[0].label).toBe('21');
        expect(opts.filter((o) => o.label === '21')).toHaveLength(1);
    });

    it('keeps the correct option even across many seeds', () => {
        for (let seed = 0; seed < 30; seed++) {
            const cards = [c('9'), c('4')]; // hard 13
            const opts = buildOptions(cards, createRng(seed));
            expect(opts).toHaveLength(4);
            expect(new Set(opts.map((o) => o.label)).size).toBe(4);
            expect(opts.filter((o) => o.correct)).toHaveLength(1);
            expect(opts.find((o) => o.correct)!.label).toBe('13');
        }
    });
});

describe('dealHand', () => {
    const infinite = (rank: Rank): CardSource => ({
        draw: () => c(rank),
        needsShuffle: () => false,
        reshuffle: () => {},
    });

    it('draws two to five cards when no count is given', () => {
        const sizes = new Set<number>();
        for (let seed = 0; seed < 60; seed++) sizes.add(dealHand(infinite('5'), createRng(seed)).length);
        expect(Math.min(...sizes)).toBe(2);
        expect(Math.max(...sizes)).toBe(5);
    });

    it('draws exactly the requested number of cards', () => {
        for (const n of [2, 3, 4, 5]) {
            expect(dealHand(infinite('5'), createRng(1), n)).toHaveLength(n);
        }
    });

    it('reshuffles the source when it asks to be shuffled', () => {
        let reshuffled = false;
        const source: CardSource = {
            draw: () => c('5'),
            needsShuffle: () => true,
            reshuffle: () => { reshuffled = true; },
        };
        dealHand(source, createRng(1));
        expect(reshuffled).toBe(true);
    });
});

describe('explainHand', () => {
    it('chunks tens, makes tens, and counts the ace as 1 when 11 would bust', () => {
        expect(explainHand([c('K'), c('6'), c('4'), c('A')])).toEqual([
            'Tens: K = 10.',
            '4 + 6 = 10 → 20.',
            'Ace: 11 would bust, so count it as 1 → 21.',
            'Total: 21.',
        ]);
    });

    it('counts the ace as 11 when it fits and shows both readings', () => {
        expect(explainHand([c('A'), c('7')])).toEqual([
            'Add 7 → 7.',
            'Ace: 11 fits → 18 (or as 1 → 8).',
            'Total: 8/18.',
        ]);
    });

    it('flags a bust in the final line', () => {
        expect(explainHand([c('Q'), c('9'), c('5')])).toEqual([
            'Tens: Q = 10.',
            'Add 9 → 19.',
            'Add 5 → 24.',
            'Total: 24 — busted.',
        ]);
    });

    it('ends every breakdown with the correct total label', () => {
        const hands: Card[][] = [
            [c('A'), c('K')],
            [c('5'), c('5'), c('5')],
            [c('A'), c('A'), c('9')],
        ];
        for (const cards of hands) {
            const steps = explainHand(cards);
            expect(steps[steps.length - 1]).toContain(formatValue(handValue(cards)));
        }
    });
});
