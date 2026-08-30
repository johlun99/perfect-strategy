import { describe, it, expect } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
    it('produces numbers in [0, 1)', () => {
        const rng = createRng(42);
        for (let i = 0; i < 100; i++) {
            const n = rng();
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThan(1);
        }
    });

    it('is deterministic for a given seed', () => {
        const a = createRng(123);
        const b = createRng(123);
        const seqA = Array.from({ length: 5 }, () => a());
        const seqB = Array.from({ length: 5 }, () => b());
        expect(seqA).toEqual(seqB);
    });

    it('differs across seeds', () => {
        const a = createRng(1);
        const b = createRng(2);
        expect(a()).not.toEqual(b());
    });
});
