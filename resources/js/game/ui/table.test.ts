// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../engine/game';
import type { CardSource } from '../engine/shoe';
import type { Card, Rank } from '../engine/card';
import { CHERRY_RULES } from '../engine/rules';
import { Table } from './table';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });
function stack(...ranks: Rank[]): CardSource {
    const cards = ranks.map(c);
    let i = 0;
    return { draw: () => cards[i++], needsShuffle: () => false, reshuffle: () => { i = 0; } };
}

// jsdom has no HTMLAudioElement.play; stub Audio so the SoundManager is inert.
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
  <button id="ruleset-toggle"></button>
  <button id="mute"></button>
  <div id="dealer-hand"></div><div id="dealer-total" hidden></div>
  <div id="banner" hidden></div>
  <div id="player-hands"></div>
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

describe('Table (UI integration)', () => {
    beforeEach(() => {
        (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
        document.body.innerHTML = MARKUP;
    });

    it('renders the starting bankroll and disables Deal with no bet', () => {
        const game = new Game({ source: stack('10', '10', '9', '7'), startingChips: 1000 });
        new Table(document.getElementById('table')!, game);
        expect(document.getElementById('chips')!.textContent).toBe('1000');
        expect((document.getElementById('deal') as HTMLButtonElement).disabled).toBe(true);
        expect(document.querySelectorAll('#chip-rack .chip')).toHaveLength(4);
    });

    it('plays a full round: bet, deal, stand, and win', () => {
        const game = new Game({ source: stack('10', '10', '9', '7'), startingChips: 1000 }); // 19 vs 17
        new Table(document.getElementById('table')!, game);

        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.querySelector('#chip-rack .chip[data-value="5"]')); // bet 10
        expect(document.getElementById('bet')!.textContent).toBe('10');
        expect((document.getElementById('deal') as HTMLButtonElement).disabled).toBe(false);

        click(document.getElementById('deal'));
        expect(document.getElementById('chips')!.textContent).toBe('990');
        expect(document.querySelectorAll('#dealer-hand .card')).toHaveLength(2);
        expect(document.querySelectorAll('#player-hands .hand .card')).toHaveLength(2);
        // hole card is face-down during the player's turn
        expect(document.querySelector('#dealer-hand .card.flip')).not.toBeNull();
        expect(document.getElementById('action-controls')!.hidden).toBe(false);
        expect(document.getElementById('bet-controls')!.hidden).toBe(true);

        click(document.querySelector('[data-action="stand"]'));
        expect(game.phase).toBe('settled');
        expect(document.getElementById('chips')!.textContent).toBe('1010');
        expect(document.getElementById('banner')!.hidden).toBe(false);
        expect(document.getElementById('banner')!.textContent).toContain('You win');
        expect(document.querySelector('.pill--result')!.textContent).toBe('win');
        // hole card revealed
        expect(document.querySelector('#dealer-hand .card.flip.revealed')).not.toBeNull();
    });

    it('shows insurance controls when the dealer shows an ace', () => {
        const game = new Game({ source: stack('10', 'A', '9', 'K'), startingChips: 1000 });
        new Table(document.getElementById('table')!, game);
        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.getElementById('deal'));
        expect(game.phase).toBe('insurance');
        expect(document.getElementById('insurance-controls')!.hidden).toBe(false);
    });

    it('celebrates a player natural blackjack with a jackpot banner and gold confetti', () => {
        // player A+K = 21 (natural), dealer 9+7 = 16
        const game = new Game({ source: stack('A', '9', 'K', '7'), startingChips: 1000 });
        new Table(document.getElementById('table')!, game);
        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.getElementById('deal'));

        expect(game.phase).toBe('settled');
        const banner = document.getElementById('banner')!;
        expect(banner.textContent).toContain('Blackjack!');
        expect(banner.classList.contains('banner--jackpot')).toBe(true);

        const pill = document.querySelector('.pill--result')!;
        expect(pill.classList.contains('pill--blackjack')).toBe(true);
        expect(pill.textContent).toBe('blackjack');

        expect(document.querySelector('#player-hands .hand--blackjack')).not.toBeNull();
        expect(document.querySelectorAll('.fx-layer .confetti.confetti--gold').length).toBeGreaterThan(0);
    });

    it('labels the ruleset toggle and flips the stored ruleset on click', () => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k),
            clear: () => store.clear(),
        });
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { value: { reload }, writable: true });

        const game = new Game({ source: stack('10', '10', '9', '7'), startingChips: 1000, rules: CHERRY_RULES });
        new Table(document.getElementById('table')!, game);

        const btn = document.getElementById('ruleset-toggle')!;
        expect(btn.textContent).toContain('Cherry');

        btn.click();
        expect(store.get('bj:ruleset')).toBe('international'); // flipped away from Cherry
        expect(reload).toHaveBeenCalled();
    });

    it('shows a dealer blackjack loss screen with ash confetti', () => {
        // player 10+7 = 17, dealer K+A = 21 (ten upcard -> peeks, no insurance prompt)
        const game = new Game({ source: stack('10', 'K', '7', 'A'), startingChips: 1000 });
        new Table(document.getElementById('table')!, game);
        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.querySelector('#chip-rack .chip[data-value="5"]'));
        click(document.getElementById('deal'));

        expect(game.phase).toBe('settled');
        const banner = document.getElementById('banner')!;
        expect(banner.textContent).toContain('Dealer Blackjack');
        expect(banner.classList.contains('banner--dealer-bj')).toBe(true);

        expect(document.getElementById('dealer-hand')!.classList.contains('hand--dealer-bj')).toBe(true);
        expect(document.querySelectorAll('.fx-layer .confetti.confetti--ash').length).toBeGreaterThan(0);
    });
});
