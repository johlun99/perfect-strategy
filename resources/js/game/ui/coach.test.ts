// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../engine/game';
import type { CardSource } from '../engine/shoe';
import type { Card, Rank } from '../engine/card';
import { Table } from './table';
import { StrategyCoach } from './coach';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });
function stack(...ranks: Rank[]): CardSource {
    const cards = ranks.map(c);
    let i = 0;
    return { draw: () => cards[i++], needsShuffle: () => false, reshuffle: () => { i = 0; } };
}

class FakeAudio {
    src: string;
    volume = 1;
    preload = '';
    constructor(src?: string) { this.src = src ?? ''; }
    play() { return Promise.resolve(); }
    cloneNode() { return new FakeAudio(this.src); }
}

const MARKUP = `
<main id="table">
  <button id="mute"></button>
  <div id="dealer-hand"></div><div id="dealer-total" hidden></div>
  <div id="banner" hidden></div>
  <div id="player-hands"></div>
  <div id="coach-hint" hidden></div>
  <div id="coach-scorecard"></div>
  <button id="coach-chart-toggle"></button>
  <div id="coach-chart" hidden></div>
  <div id="coach-review" hidden></div>
  <span id="chips">0</span><span id="bet">0</span>
  <div id="bet-controls">
    <div id="chip-rack"></div>
    <button id="clear-bet"></button>
    <button id="deal" disabled></button>
  </div>
  <div id="action-controls" hidden>
    <button data-action="hit"></button><button data-action="stand"></button>
    <button data-action="double"></button><button data-action="split"></button>
    <button data-action="surrender"></button>
  </div>
  <div id="insurance-controls" hidden>
    <button data-insurance="yes"></button><button data-insurance="no"></button>
  </div>
</main>`;

const click = (el: Element | null) => (el as HTMLElement).click();
const bolds = () => Array.from(document.querySelectorAll('#coach-scorecard b')).map((b) => b.textContent);

/** Bet 10 and deal. */
function deal(): void {
    click(document.querySelector('#chip-rack .chip[data-value="5"]'));
    click(document.querySelector('#chip-rack .chip[data-value="5"]'));
    click(document.getElementById('deal'));
}

function setup(source: CardSource): Game {
    const game = new Game({ source, startingChips: 1000 });
    const root = document.getElementById('table')!;
    new Table(root, game);
    new StrategyCoach(root, game);
    return game;
}

describe('StrategyCoach (blocking trainer)', () => {
    beforeEach(() => {
        (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
        document.body.innerHTML = MARKUP;
    });

    it('blocks a wrong move and requires the correct one', () => {
        const game = setup(stack('10', '6', '2', '9', '7')); // player 10,2 = 12 vs dealer 6
        deal();
        expect(game.phase).toBe('playerTurn');

        // 12 vs 6 -> basic strategy stands. Hitting is wrong.
        click(document.querySelector('[data-action="hit"]'));
        expect(game.phase).toBe('playerTurn');
        expect(game.activeHand!.cards).toHaveLength(2); // no card drawn: the move was blocked
        expect(document.getElementById('coach-hint')!.hidden).toBe(false);
        expect(document.querySelector('[data-action="stand"]')!.classList.contains('btn--coach')).toBe(true);
        expect(bolds()[0]).toBe('0'); // no decision resolved yet
        expect(bolds()[3]).toBe('0'); // streak reset by the slip

        // Now play the correct move.
        click(document.querySelector('[data-action="stand"]'));
        expect(game.phase).toBe('settled');
        expect(bolds()[0]).toBe('1'); // 1 decision
        expect(bolds()[1]).toBe('0'); // but not correct (slipped first)
        expect(bolds()[3]).toBe('0');
        // glow/hint cleared once the round moved on
        expect(document.querySelector('.btn--coach')).toBeNull();
    });

    it('accepts a correct move on the first try', () => {
        const game = setup(stack('10', '6', '9', '9', '10')); // player 10,9 = 19 vs dealer 6
        deal();

        click(document.querySelector('[data-action="stand"]')); // 19 -> stand
        expect(game.phase).toBe('settled');
        expect(bolds()[0]).toBe('1'); // decisions
        expect(bolds()[1]).toBe('1'); // correct
        expect(bolds()[3]).toBe('1'); // streak
    });

    it('blocks taking insurance and lets you decline', () => {
        const game = setup(stack('10', 'A', '9', 'K')); // dealer shows an ace
        deal();
        expect(game.phase).toBe('insurance');

        click(document.querySelector('[data-insurance="yes"]'));
        expect(game.phase).toBe('insurance'); // blocked
        expect(document.querySelector('[data-insurance="no"]')!.classList.contains('btn--coach')).toBe(true);

        click(document.querySelector('[data-insurance="no"]'));
        expect(game.phase).not.toBe('insurance'); // proceeded
    });

    it('re-evaluates each hand after a split', () => {
        // player 8,8 vs dealer 6 -> split. Then each hand gets a new card.
        // draws: P8, D6, P8, Dhole9, then split draws: hand0 <-2, hand1 <-2
        const game = setup(stack('8', '6', '8', '9', '2', '2', '10', '10'));
        deal();

        // 8,8 -> split is correct; hit would be wrong.
        click(document.querySelector('[data-action="hit"]'));
        expect(document.querySelector('[data-action="split"]')!.classList.contains('btn--coach')).toBe(true);
        expect(game.hands).toHaveLength(1); // blocked

        click(document.querySelector('[data-action="split"]'));
        expect(game.hands).toHaveLength(2); // split happened; now coaching the first split hand
        expect(game.phase).toBe('playerTurn');
    });

    it('reveals the strategy chart on toggle', () => {
        setup(stack('10', '6', '9', '9'));
        const chart = document.getElementById('coach-chart')!;
        expect(chart.hidden).toBe(true);

        click(document.getElementById('coach-chart-toggle'));
        expect(chart.hidden).toBe(false);
        expect(chart.querySelectorAll('.chart__table').length).toBe(3); // hard, soft, pairs
        expect(chart.querySelectorAll('td.cell').length).toBeGreaterThan(0);
    });

    it('lists the round mistakes in the review at round end', () => {
        setup(stack('10', '6', '2', '9', '7')); // 12 vs 6
        deal();
        click(document.querySelector('[data-action="hit"]'));  // wrong
        click(document.querySelector('[data-action="stand"]')); // correct -> round ends

        const review = document.getElementById('coach-review')!;
        expect(review.hidden).toBe(false);
        expect(review.querySelectorAll('li').length).toBe(1);
    });
});
