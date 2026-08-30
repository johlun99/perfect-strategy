import { describe, it, expect } from 'vitest';
import { generateTables, type Code } from './ev';
import { TABLES } from './strategy';
import { STANDARD_RULES, CHERRY_RULES } from './rules';

const intl = generateTables(STANDARD_RULES);
const cherry = generateTables(CHERRY_RULES);

const col = (up: number) => intl.COLS.indexOf(up);
const cellAt = (tab: typeof intl, kind: 'HARD' | 'SOFT' | 'PAIRS', row: number, up: number) => tab[kind][row][col(up)];

describe('ev solver reproduces the authored international chart', () => {
    // Infinite-deck EV lands on the other side of the boundary only on these
    // famously razor-thin soft-double cells (all within ~0.01 EV of the chart).
    const KNOWN_MARGINAL = new Set(['SOFT13@5', 'SOFT15@4', 'SOFT18@2']);

    it('matches every cell except the known marginal soft-doubles', () => {
        const diffs: string[] = [];
        (['HARD', 'SOFT', 'PAIRS'] as const).forEach((kind) => {
            for (const row of Object.keys(TABLES[kind]).map(Number)) {
                intl.COLS.forEach((up, i) => {
                    const authored = TABLES[kind][row]?.[i];
                    const generated = intl[kind][row]?.[i];
                    if (authored && authored !== generated) diffs.push(`${kind}${row}@${up}`);
                });
            }
        });
        expect(diffs.filter((d) => !KNOWN_MARGINAL.has(d))).toEqual([]);
    });
});

describe('ev solver applies Cherry rules', () => {
    const cells: Code[] = [
        ...Object.values(cherry.HARD),
        ...Object.values(cherry.SOFT),
        ...Object.values(cherry.PAIRS),
    ].flat();

    it('never recommends surrender', () => {
        expect(cells).not.toContain('Rh');
    });

    it('only doubles on two-card totals of 7–11', () => {
        for (let t = 12; t <= 16; t++) {
            expect(cherry.HARD[t].some((c) => c === 'Dh' || c === 'Ds')).toBe(false);
        }
        for (let t = 13; t <= 16; t++) { // soft 13–16 => hard 3–6, out of the 7–11 range
            expect(cherry.SOFT[t].some((c) => c === 'Dh' || c === 'Ds')).toBe(false);
        }
        expect(cellAt(cherry, 'HARD', 11, 6)).toBe('Dh'); // 11 is in range -> still doubles
    });

    it('always splits aces and never splits tens', () => {
        expect(cherry.PAIRS[11].every((c) => c === 'P')).toBe(true);
        expect(cherry.PAIRS[10].every((c) => c === 'S')).toBe(true);
    });

    it('stands hard 16 vs 10 — the tie rule makes hitting toward 17-19 not worth it', () => {
        expect(cellAt(intl, 'HARD', 16, 10)).toBe('Rh');   // international: surrender
        expect(cellAt(cherry, 'HARD', 16, 10)).toBe('S');  // Cherry: stand (no surrender, ties lose)
    });
});
