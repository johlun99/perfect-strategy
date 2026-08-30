// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { celebrate } from './confetti';

function mockReducedMotion(reduce: boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
    }));
}

describe('celebrate (confetti burst)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mockReducedMotion(false);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('spawns `count` confetti particles inside a single .fx-layer under body', () => {
        const particles = celebrate(document.body, { count: 12 });

        const layer = document.querySelector('.fx-layer');
        expect(layer).not.toBeNull();
        expect(layer!.parentElement).toBe(document.body);
        expect(layer!.querySelectorAll('.confetti')).toHaveLength(12);
        expect(particles).toHaveLength(12);
    });

    it('tags particles with the variant palette class', () => {
        celebrate(document.body, { count: 4, variant: 'ash' });
        expect(document.querySelectorAll('.confetti.confetti--ash')).toHaveLength(4);
        expect(document.querySelectorAll('.confetti.confetti--gold')).toHaveLength(0);
    });

    it('defaults to the gold variant', () => {
        celebrate(document.body, { count: 3 });
        expect(document.querySelectorAll('.confetti.confetti--gold')).toHaveLength(3);
    });

    it('does nothing when the user prefers reduced motion', () => {
        mockReducedMotion(true);
        const particles = celebrate(document.body, { count: 20 });
        expect(particles).toEqual([]);
        expect(document.querySelector('.fx-layer')).toBeNull();
    });

    it('reuses a single .fx-layer across calls', () => {
        celebrate(document.body, { count: 2 });
        celebrate(document.body, { count: 2 });
        expect(document.querySelectorAll('.fx-layer')).toHaveLength(1);
        expect(document.querySelectorAll('.confetti')).toHaveLength(4);
    });
});
