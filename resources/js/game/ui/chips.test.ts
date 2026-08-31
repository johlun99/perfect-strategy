// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarkTray } from './chips';

/**
 * jsdom has no layout (getBoundingClientRect is all zeros) and never fires
 * `animationend`, so these tests assert the tray's stack accounting and DOM
 * token lifecycle, not pixel travel. The slide motion is verified in-browser.
 */
describe('MarkTray', () => {
    let spot: HTMLElement;
    let rack: HTMLElement;
    let bank: HTMLElement;
    let dealer: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="rack"></div>
            <div id="spot"></div>
            <div id="bank"></div>
            <div id="dealer"></div>`;
        rack = document.getElementById('rack')!;
        spot = document.getElementById('spot')!;
        bank = document.getElementById('bank')!;
        dealer = document.getElementById('dealer')!;
        // Default to "motion allowed" so the sliding path is exercised.
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
    });

    it('spawns a denominated chip token in a persistent overlay and stacks it', () => {
        const tray = new MarkTray();
        tray.place(25, rack, spot);

        const marks = document.querySelectorAll('.mark-layer .mark');
        expect(marks).toHaveLength(1);
        expect(marks[0].classList.contains('mark--25')).toBe(true);
        expect(tray.size()).toBe(1);
        expect(tray.total()).toBe(25);
    });

    it('accumulates a stack across multiple placements', () => {
        const tray = new MarkTray();
        tray.place(100, rack, spot);
        tray.place(25, rack, spot);
        tray.place(5, rack, spot);

        expect(document.querySelectorAll('.mark-layer .mark')).toHaveLength(3);
        expect(tray.size()).toBe(3);
        expect(tray.total()).toBe(130);
    });

    it('reuses a single overlay across trays instead of stacking layers', () => {
        new MarkTray().place(5, rack, spot);
        new MarkTray().place(5, rack, spot);
        expect(document.querySelectorAll('.mark-layer')).toHaveLength(1);
    });

    it('plays the slide sound when a chip is placed', () => {
        const play = vi.fn();
        const tray = new MarkTray(play);
        tray.place(5, rack, spot);
        expect(play).toHaveBeenCalledWith('chip-slide');
    });

    it('clear() empties the stack', () => {
        const tray = new MarkTray();
        tray.place(5, rack, spot);
        tray.place(5, rack, spot);
        tray.clear();
        expect(tray.size()).toBe(0);
        expect(tray.total()).toBe(0);
    });

    it('toBank() empties the stack and plays the clirr', () => {
        const play = vi.fn();
        const tray = new MarkTray(play);
        tray.place(100, rack, spot);
        tray.toBank(spot, bank);
        expect(tray.size()).toBe(0);
        expect(play).toHaveBeenCalledWith('chip-clirr');
    });

    it('toDealer() empties the stack', () => {
        const tray = new MarkTray();
        tray.place(100, rack, spot);
        tray.place(5, rack, spot);
        tray.toDealer(spot, dealer);
        expect(tray.size()).toBe(0);
    });

    it('resolving an empty stack is a no-op and does not throw', () => {
        const tray = new MarkTray();
        expect(() => tray.toBank(spot, bank)).not.toThrow();
        expect(() => tray.toDealer(spot, dealer)).not.toThrow();
        expect(tray.size()).toBe(0);
    });

    it('under reduced motion, chips still place and resolve without animation classes', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const tray = new MarkTray();
        tray.place(25, rack, spot);
        const mark = document.querySelector('.mark-layer .mark')!;
        expect(mark.classList.contains('mark--sliding')).toBe(false);
        expect(tray.size()).toBe(1);
        tray.toBank(spot, bank);
        expect(tray.size()).toBe(0);
    });
});
