import type { Card } from '../engine/card';
import type { CardSource } from '../engine/shoe';
import { Shoe } from '../engine/shoe';
import type { Rng } from '../engine/rng';
import { createRng } from '../engine/rng';
import { handValue } from '../engine/hand';
import { buildOptions, dealHand, explainHand, formatValue } from '../engine/hand-value-quiz';
import { createCardEl } from './cards';
import { SoundManager } from './audio';

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel);

const DEFAULT_DURATION_MS = 7000;
const ADVANCE_MS = 650;

interface QuizOptions {
    source?: CardSource;
    rng?: Rng;
    durationMs?: number;
}

/**
 * "Hand Value" practice: deal a hand, ask the player to call its total from four
 * options. A wrong pick (or the countdown running out) is a miss — the correct
 * option glows and must be clicked to continue (block-until-correct).
 */
export class HandValueQuiz {
    private sound = new SoundManager();
    private source: CardSource;
    private rng: Rng;
    private durationMs: number;

    private handEl: HTMLElement | null;
    private optionsEl: HTMLElement;
    private timerBar: HTMLElement | null;
    private hintEl: HTMLElement | null;
    private scoreEl: HTMLElement | null;
    private cardcountEl: HTMLElement | null;
    private guideEl: HTMLElement | null;

    private stats = { hands: 0, correct: 0, streak: 0, best: 0 };
    private handSize: number | null = null;   // null = "mix" (random 2–5)
    private currentCards: Card[] = [];
    private erred = false;      // wrong pick or timeout on the current hand?
    private answered = false;   // correct option already clicked?
    private correctLabel = '';
    private timerId: ReturnType<typeof setTimeout> | undefined;
    private advanceId: ReturnType<typeof setTimeout> | undefined;

    constructor(root: HTMLElement, opts: QuizOptions = {}) {
        this.source = opts.source ?? new Shoe(6, createRng((Math.random() * 2 ** 32) >>> 0));
        this.rng = opts.rng ?? Math.random;
        this.durationMs = opts.durationMs ?? DEFAULT_DURATION_MS;

        this.handEl = $(root, '#quiz-hand');
        this.optionsEl = $(root, '#quiz-options')!;
        this.timerBar = $(root, '.quiz-timer__bar');
        this.hintEl = $(root, '#quiz-hint');
        this.scoreEl = $(root, '#quiz-scorecard');
        this.cardcountEl = $(root, '#quiz-cardcount');
        this.guideEl = $(root, '#quiz-guide');

        this.sound.preload(['wrong', 'win']);
        this.optionsEl.addEventListener('click', this.onClick);
        this.cardcountEl?.addEventListener('click', this.onCardCount);
        this.markCardCount('mix');

        const mute = $(root, '#mute');
        mute?.addEventListener('click', () => {
            mute.textContent = this.sound.toggleMute() ? '🔇' : '🔊';
        });

        this.renderScore();
        this.nextHand();
    }

    // --- round cycle -------------------------------------------------------

    private nextHand(): void {
        clearTimeout(this.advanceId);
        this.erred = false;
        this.answered = false;

        const cards = dealHand(this.source, this.rng, this.handSize ?? undefined);
        this.currentCards = cards;
        this.correctLabel = formatValue(handValue(cards));

        if (this.handEl) {
            this.handEl.replaceChildren(...cards.map((card) => createCardEl(card)));
        }

        this.optionsEl.replaceChildren(
            ...buildOptions(cards, this.rng).map((opt) => {
                const btn = document.createElement('button');
                btn.className = 'btn quiz-option';
                btn.textContent = opt.label;
                return btn;
            }),
        );

        this.hideHint();
        this.hideGuide();
        this.clearGlow();
        this.startTimer();
    }

    private onCardCount = (e: MouseEvent): void => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-count]');
        if (!btn) return;
        const v = btn.dataset.count!;
        this.handSize = v === 'mix' ? null : Number(v);
        this.markCardCount(v);
        this.nextHand();
    };

    private onClick = (e: MouseEvent): void => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
        if (!btn || this.answered) return;
        if (btn.textContent === this.correctLabel) this.resolveCorrect(btn);
        else this.resolveWrong(btn);
    };

    private resolveCorrect(btn: HTMLButtonElement): void {
        this.answered = true;
        this.stopTimer();

        if (!this.erred) {
            this.stats.correct++;
            this.stats.streak++;
            this.stats.best = Math.max(this.stats.best, this.stats.streak);
            this.sound.play('win');
        }
        this.stats.hands++;
        btn.classList.add('quiz-option--right');
        this.renderScore();

        this.advanceId = setTimeout(() => this.nextHand(), ADVANCE_MS);
    }

    private resolveWrong(btn: HTMLButtonElement): void {
        if (!this.erred) {
            this.erred = true;
            this.stats.streak = 0;
        }
        btn.classList.add('quiz-option--wrong');
        this.glowCorrect();
        this.showHint(`Not quite — it's ${this.correctLabel}`);
        this.showGuide();
        this.sound.play('wrong');
        this.renderScore();
    }

    private timeUp(): void {
        if (this.answered) return;
        if (!this.erred) {
            this.erred = true;
            this.stats.streak = 0;
        }
        this.glowCorrect();
        this.showHint(`Time's up — it's ${this.correctLabel}`);
        this.showGuide();
        this.sound.play('wrong');
        this.renderScore();
    }

    // --- timer -------------------------------------------------------------

    private startTimer(): void {
        this.stopTimer();
        const bar = this.timerBar;
        if (bar) {
            bar.style.transition = 'none';
            bar.style.width = '100%';
            void bar.offsetWidth; // reflow so the shrink transition actually runs
            bar.style.transition = `width ${this.durationMs}ms linear`;
            bar.style.width = '0%';
        }
        this.timerId = setTimeout(() => this.timeUp(), this.durationMs);
    }

    private stopTimer(): void {
        clearTimeout(this.timerId);
        if (this.timerBar) this.timerBar.style.transition = 'none';
    }

    // --- feedback / rendering ----------------------------------------------

    private glowCorrect(): void {
        this.clearGlow();
        for (const btn of this.optionsEl.querySelectorAll('button')) {
            if (btn.textContent === this.correctLabel) btn.classList.add('btn--coach');
        }
    }

    private clearGlow(): void {
        this.optionsEl.querySelectorAll('.btn--coach').forEach((b) => b.classList.remove('btn--coach'));
    }

    private showHint(text: string): void {
        if (!this.hintEl) return;
        this.hintEl.textContent = text;
        this.hintEl.hidden = false;
    }

    private hideHint(): void {
        if (this.hintEl) this.hintEl.hidden = true;
    }

    private markCardCount(active: string): void {
        this.cardcountEl?.querySelectorAll<HTMLElement>('[data-count]').forEach((b) => {
            b.classList.toggle('is-active', b.dataset.count === active);
        });
    }

    private showGuide(): void {
        if (!this.guideEl) return;
        this.guideEl.innerHTML =
            '<p class="quiz-guide__title">Count it in chunks:</p><ol class="quiz-guide__list">' +
            explainHand(this.currentCards).map((s) => `<li>${s}</li>`).join('') +
            '</ol>';
        this.guideEl.hidden = false;
    }

    private hideGuide(): void {
        if (this.guideEl) this.guideEl.hidden = true;
    }

    private renderScore(): void {
        if (!this.scoreEl) return;
        const { hands, correct, streak } = this.stats;
        const pct = hands ? Math.round((correct / hands) * 100) : 100;
        this.scoreEl.innerHTML =
            `<span class="score__item">Hands <b>${hands}</b></span>` +
            `<span class="score__item">Correct <b>${correct}</b></span>` +
            `<span class="score__item">Accuracy <b>${pct}%</b></span>` +
            `<span class="score__item">Streak <b>${streak}</b></span>`;
    }
}
