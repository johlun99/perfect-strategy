import { describe, it, expect } from 'vitest';
import { Bankroll } from './bankroll';

describe('Bankroll', () => {
    it('starts with the given balance', () => {
        expect(new Bankroll(1000).balance).toBe(1000);
    });

    it('reports whether a bet is affordable', () => {
        const b = new Bankroll(100);
        expect(b.canAfford(100)).toBe(true);
        expect(b.canAfford(101)).toBe(false);
    });

    it('removes placed chips from the balance', () => {
        const b = new Bankroll(1000);
        b.place(150);
        expect(b.balance).toBe(850);
    });

    it('refuses to place more than the balance', () => {
        const b = new Bankroll(100);
        expect(() => b.place(200)).toThrow();
        expect(b.balance).toBe(100);
    });

    it('adds credited chips back to the balance', () => {
        const b = new Bankroll(1000);
        b.place(100);
        b.credit(250);
        expect(b.balance).toBe(1150);
    });
});
