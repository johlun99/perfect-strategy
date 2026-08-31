// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CardSource } from '../engine/shoe';
import type { Card, Rank } from '../engine/card';
import { handValue } from '../engine/hand';
import { formatValue } from '../engine/hand-value-quiz';
import { HandValueQuiz } from './hand-value';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });

/** A rigged, looping card source: draws the given ranks in order, forever. */
function stack(...ranks: Rank[]): CardSource {
    const cards = ranks.map(c);
    let i = 0;
    return {
        draw: () => cards[i++ % cards.length],
        needsShuffle: () => false,
        reshuffle: () => { i = 0; },
    };
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
  <div id="quiz-scorecard"></div>
  <div id="quiz-timer"><span class="quiz-timer__bar"></span></div>
  <div id="quiz-hand"></div>
  <div id="quiz-hint" hidden></div>
  <div id="quiz-guide" hidden></div>
  <div id="quiz-options"></div>
  <div id="quiz-cardcount">
    <button data-count="mix"></button>
    <button data-count="2"></button>
    <button data-count="3"></button>
    <button data-count="4"></button>
    <button data-count="5"></button>
  </div>
</main>`;

const DURATION = 5000;

// rng that always returns 0: deal draws 2 cards, shuffles are deterministic.
const zeroRng = () => 0;

const bolds = () => Array.from(document.querySelectorAll('#quiz-scorecard b')).map((b) => b.textContent);
const optionButtons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('#quiz-options button'));
const buttonFor = (label: string) => optionButtons().find((b) => b.textContent === label)!;
const aWrongButton = (correct: string) => optionButtons().find((b) => b.textContent !== correct)!;

function setup(source: CardSource): HandValueQuiz {
    const root = document.getElementById('table')!;
    return new HandValueQuiz(root, { source, rng: zeroRng, durationMs: DURATION });
}

describe('HandValueQuiz', () => {
    beforeEach(() => {
        (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
        vi.useFakeTimers();
        document.body.innerHTML = MARKUP;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders a hand and four answer options, exactly one correct', () => {
        setup(stack('10', '8'));
        expect(document.querySelectorAll('#quiz-hand .card').length).toBe(2);
        const opts = optionButtons();
        expect(opts).toHaveLength(4);
        const correct = formatValue(handValue([c('10'), c('8')])); // "18"
        expect(opts.filter((b) => b.textContent === correct)).toHaveLength(1);
    });

    it('counts a clean correct answer and advances to a new hand', () => {
        setup(stack('10', '8', '9', '9'));
        const correct = formatValue(handValue([c('10'), c('8')])); // "18"

        buttonFor(correct).click();
        // Hands, Correct, Accuracy, Streak
        expect(bolds()[0]).toBe('1');
        expect(bolds()[1]).toBe('1');
        expect(bolds()[3]).toBe('1');

        vi.advanceTimersByTime(1000); // let the next hand deal
        const next = formatValue(handValue([c('9'), c('9')])); // "18" again
        expect(buttonFor(next)).toBeTruthy();
    });

    it('blocks a wrong answer: glows the correct option and does not advance', () => {
        setup(stack('10', '8'));
        const correct = formatValue(handValue([c('10'), c('8')])); // "18"

        aWrongButton(correct).click();
        expect(bolds()[0]).toBe('0'); // hand not resolved
        expect(bolds()[3]).toBe('0'); // streak reset
        expect(document.getElementById('quiz-hint')!.hidden).toBe(false);
        expect(buttonFor(correct).classList.contains('btn--coach')).toBe(true);

        // must click the correct one to move on; it counts as a miss (not correct)
        buttonFor(correct).click();
        expect(bolds()[0]).toBe('1'); // hand resolved
        expect(bolds()[1]).toBe('0'); // but not correct — slipped first
        expect(bolds()[3]).toBe('0');
    });

    it('deals the chosen number of cards when a size is picked', () => {
        setup(stack('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J'));
        const three = document.querySelector<HTMLButtonElement>('[data-count="3"]')!;
        three.click();
        expect(document.querySelectorAll('#quiz-hand .card').length).toBe(3);
        expect(three.classList.contains('is-active')).toBe(true);
    });

    it('shows the counting guide after a wrong answer', () => {
        setup(stack('10', '8'));
        const correct = formatValue(handValue([c('10'), c('8')]));
        aWrongButton(correct).click();
        const guide = document.getElementById('quiz-guide')!;
        expect(guide.hidden).toBe(false);
        expect(guide.querySelectorAll('li').length).toBeGreaterThan(0);
    });

    it('shows the counting guide when the timer runs out', () => {
        setup(stack('10', '8'));
        vi.advanceTimersByTime(DURATION);
        expect(document.getElementById('quiz-guide')!.hidden).toBe(false);
    });

    it('hides the guide on the next hand', () => {
        setup(stack('10', '8', '9', '9'));
        const correct = formatValue(handValue([c('10'), c('8')]));
        aWrongButton(correct).click();
        buttonFor(correct).click();
        vi.advanceTimersByTime(1000);
        expect(document.getElementById('quiz-guide')!.hidden).toBe(true);
    });

    it('toggles mute and swaps the speaker icon', () => {
        setup(stack('10', '8'));
        const mute = document.getElementById('mute')!;
        mute.click();
        expect(mute.textContent).toBe('🔇');
        mute.click();
        expect(mute.textContent).toBe('🔊');
    });

    it('marks a timeout as a miss but still requires the correct answer', () => {
        setup(stack('10', '8'));
        const correct = formatValue(handValue([c('10'), c('8')])); // "18"

        vi.advanceTimersByTime(DURATION); // clock runs out
        expect(bolds()[0]).toBe('0'); // still unresolved
        expect(bolds()[3]).toBe('0'); // streak gone
        expect(document.getElementById('quiz-hint')!.hidden).toBe(false);
        expect(buttonFor(correct).classList.contains('btn--coach')).toBe(true);

        buttonFor(correct).click();
        expect(bolds()[0]).toBe('1'); // resolved
        expect(bolds()[1]).toBe('0'); // not correct — timed out
    });
});
