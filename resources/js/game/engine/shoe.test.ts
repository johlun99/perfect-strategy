import { describe, it, expect } from 'vitest';
import { buildShoe, Shoe } from './shoe';
import { createRng } from './rng';
import type { Card } from './card';

const key = (c: Card) => `${c.rank}-${c.suit}`;

describe('buildShoe', () => {
    it('holds 52 cards per deck', () => {
        expect(buildShoe(1)).toHaveLength(52);
        expect(buildShoe(6)).toHaveLength(312);
    });

    it('contains each unique card once per deck', () => {
        const counts = new Map<string, number>();
        for (const c of buildShoe(6)) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
        expect(counts.size).toBe(52);
        for (const n of counts.values()) expect(n).toBe(6);
    });
});

describe('Shoe', () => {
    it('shuffles deterministically for a given seed', () => {
        const a = new Shoe(6, createRng(7));
        const b = new Shoe(6, createRng(7));
        const drawA = Array.from({ length: 10 }, () => key(a.draw()));
        const drawB = Array.from({ length: 10 }, () => key(b.draw()));
        expect(drawA).toEqual(drawB);
    });

    it('actually reorders the cards (not left sorted)', () => {
        const shoe = new Shoe(1, createRng(99));
        const drawn = Array.from({ length: 52 }, () => key(shoe.draw()));
        const fresh = buildShoe(1).map(key);
        expect(drawn).not.toEqual(fresh);
    });

    it('draws cards and tracks how many remain', () => {
        const shoe = new Shoe(1, createRng(1));
        expect(shoe.remaining).toBe(52);
        shoe.draw();
        shoe.draw();
        expect(shoe.remaining).toBe(50);
    });

    it('flags a reshuffle once penetration is passed', () => {
        const shoe = new Shoe(1, createRng(1), 0.5); // reshuffle after half dealt
        expect(shoe.needsShuffle()).toBe(false);
        for (let i = 0; i < 27; i++) shoe.draw(); // >50% of 52
        expect(shoe.needsShuffle()).toBe(true);
    });

    it('refills to a full shoe on reshuffle', () => {
        const shoe = new Shoe(1, createRng(1));
        for (let i = 0; i < 40; i++) shoe.draw();
        shoe.reshuffle();
        expect(shoe.remaining).toBe(52);
        expect(shoe.needsShuffle()).toBe(false);
    });
});
