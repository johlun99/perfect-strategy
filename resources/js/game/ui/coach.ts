import type { Game } from '../engine/game';
import { handValue } from '../engine/hand';
import { rankValue } from '../engine/card';
import { recommend, shouldTakeInsurance, INSURANCE_REASON, TABLES_BY_ID } from '../engine/strategy';
import type { Code } from '../engine/ev';
import { SoundManager } from './audio';

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel);

const CODE_LABEL: Record<Code, string> = { H: 'H', S: 'S', Dh: 'D', Ds: 'D', Rh: 'R', P: 'P' };
const colLabel = (up: number) => (up === 11 ? 'A' : String(up));

/**
 * Layers a blocking basic-strategy trainer over an existing Table + Game.
 * A move that deviates from basic strategy is intercepted (capture phase) before
 * the Table's own handler runs, so the wrong action never reaches the engine.
 */
export class StrategyCoach {
    private sound = new SoundManager();
    private slipped = false;        // has the player erred at the current decision point?
    private roundActive = false;
    private stats = { decisions: 0, correct: 0, streak: 0 };
    private roundMistakes: string[] = [];

    private actionControls: HTMLElement;
    private insuranceControls: HTMLElement;
    private hintEl: HTMLElement | null;
    private scoreEl: HTMLElement | null;
    private reviewEl: HTMLElement | null;
    private chartEl: HTMLElement | null;

    constructor(private root: HTMLElement, private game: Game) {
        this.actionControls = $(root, '#action-controls')!;
        this.insuranceControls = $(root, '#insurance-controls')!;
        this.hintEl = $(root, '#coach-hint');
        this.scoreEl = $(root, '#coach-scorecard');
        this.reviewEl = $(root, '#coach-review');
        this.chartEl = $(root, '#coach-chart');

        this.sound.preload(['wrong']);

        // Capture phase: runs before the buttons' own bubble listeners in Table.
        this.actionControls.addEventListener('click', this.gateAction, true);
        this.insuranceControls.addEventListener('click', this.gateInsurance, true);

        this.game.on('change', () => this.onChange());
        this.game.on('roundEnded', () => this.renderReview());

        this.buildChart();
        this.setupChartToggle();
        this.renderScore();
    }

    // --- interception ------------------------------------------------------

    private gateAction = (e: MouseEvent): void => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
        if (!btn || btn.disabled) return;
        if (this.game.phase !== 'playerTurn' || !this.game.activeHand) return;

        const rec = recommend(this.game.activeHand.cards, this.game.dealer[0], this.game.rules, {
            canDouble: this.game.canDouble(),
            canSplit: this.game.canSplit(),
            canSurrender: this.game.canSurrender(),
        });

        if (btn.dataset.action === rec.action) {
            this.accept();
        } else {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.reject($(this.actionControls, `[data-action="${rec.action}"]`), rec.reason);
        }
    };

    private gateInsurance = (e: MouseEvent): void => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-insurance]');
        if (!btn || btn.disabled) return;
        if (this.game.phase !== 'insurance') return;

        // Basic strategy always declines insurance.
        if (btn.dataset.insurance === 'yes' && !shouldTakeInsurance()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.reject($(this.insuranceControls, '[data-insurance="no"]'), INSURANCE_REASON);
        } else {
            this.accept();
        }
    };

    private accept(): void {
        this.stats.decisions++;
        if (!this.slipped) {
            this.stats.correct++;
            this.stats.streak++;
        }
        this.renderScore();
        // The ensuing 'change' clears the glow/hint and starts the next decision point.
    }

    private reject(correctBtn: HTMLElement | null, reason: string): void {
        if (!this.slipped) {
            this.slipped = true;
            this.roundMistakes.push(reason);
        }
        this.stats.streak = 0;
        this.clearGlow();
        correctBtn?.classList.add('btn--coach');
        this.showHint(reason);
        this.sound.play('wrong');
        this.renderScore();
    }

    // --- per-decision-point reset -----------------------------------------

    private onChange(): void {
        const phase = this.game.phase;
        if ((phase === 'playerTurn' || phase === 'insurance') && !this.roundActive) {
            this.roundActive = true;
            this.hideReview();
        }
        this.slipped = false;
        this.clearGlow();
        this.hideHint();
        this.highlightChart();
    }

    // --- rendering ---------------------------------------------------------

    private showHint(text: string): void {
        if (!this.hintEl) return;
        this.hintEl.textContent = text;
        this.hintEl.hidden = false;
    }

    private hideHint(): void {
        if (this.hintEl) this.hintEl.hidden = true;
    }

    private hideReview(): void {
        if (this.reviewEl) this.reviewEl.hidden = true;
    }

    private clearGlow(): void {
        this.root.querySelectorAll('.btn--coach').forEach((b) => b.classList.remove('btn--coach'));
    }

    private renderScore(): void {
        if (!this.scoreEl) return;
        const { decisions, correct, streak } = this.stats;
        const pct = decisions ? Math.round((correct / decisions) * 100) : 100;
        this.scoreEl.innerHTML =
            `<span class="score__item">Decisions <b>${decisions}</b></span>` +
            `<span class="score__item">Correct <b>${correct}</b></span>` +
            `<span class="score__item">Accuracy <b>${pct}%</b></span>` +
            `<span class="score__item">Streak <b>${streak}</b></span>`;
    }

    private renderReview(): void {
        if (this.reviewEl) {
            if (this.roundMistakes.length) {
                this.reviewEl.innerHTML =
                    `<h3 class="review__title">Where you slipped this round</h3><ul class="review__list">` +
                    this.roundMistakes.map((m) => `<li>✗ ${m}</li>`).join('') +
                    `</ul>`;
                this.reviewEl.hidden = false;
            } else {
                this.reviewEl.hidden = true;
            }
        }
        this.roundMistakes = [];
        this.roundActive = false;
    }

    // --- strategy chart ----------------------------------------------------

    private buildChart(): void {
        if (!this.chartEl) return;
        const { HARD, SOFT, PAIRS, COLS } = TABLES_BY_ID[this.game.rules.id];
        const header = ['', ...COLS.map(colLabel)];

        const section = (title: string, name: string, rows: Record<number, Code[]>, label: (k: number) => string) => {
            const keys = Object.keys(rows).map(Number).sort((a, b) => a - b);
            const head = header.map((h) => `<th>${h}</th>`).join('');
            const body = keys.map((k) => {
                const cells = rows[k].map((code, i) =>
                    `<td class="cell cell--${code}" data-table="${name}" data-row="${k}" data-col="${COLS[i]}">${CODE_LABEL[code]}</td>`,
                ).join('');
                return `<tr><th>${label(k)}</th>${cells}</tr>`;
            }).join('');
            return `<div class="chart__block"><h4>${title}</h4><table class="chart__table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
        };

        const softLabel = (k: number) => `A,${k - 11}`;
        const pairLabel = (k: number) => (k === 11 ? 'A,A' : `${k},${k}`);

        this.chartEl.innerHTML =
            `<div class="chart__head">` +
                `<span class="chart__title">Basic strategy · ${this.game.rules.label}</span>` +
                `<button class="chart__close" id="coach-chart-close" type="button" aria-label="Close strategy chart" title="Close">×</button>` +
            `</div>` +
            `<p class="chart__axes"><span>↓ rows — your hand</span><span>→ columns — dealer's upcard</span></p>` +
            `<div class="chart__blocks">` +
                section('Hard totals', 'hard', HARD, String) +
                section('Soft totals', 'soft', SOFT, softLabel) +
                section('Pairs', 'pairs', PAIRS, pairLabel) +
            `</div>` +
            `<p class="chart__legend">H hit · S stand · D double · R surrender · P split</p>`;
    }

    private setupChartToggle(): void {
        const toggle = $<HTMLButtonElement>(this.root, '#coach-chart-toggle');
        if (!toggle || !this.chartEl) return;
        const setOpen = (open: boolean) => {
            this.chartEl!.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
        };
        toggle.addEventListener('click', () => setOpen(!!this.chartEl!.hidden));
        $(this.chartEl, '#coach-chart-close')?.addEventListener('click', () => setOpen(false));
    }

    private highlightChart(): void {
        if (!this.chartEl) return;
        this.chartEl.querySelectorAll('.cell--current').forEach((c) => c.classList.remove('cell--current'));
        if (this.game.phase !== 'playerTurn' || !this.game.activeHand) return;

        const cards = this.game.activeHand.cards;
        const hv = handValue(cards);
        const up = rankValue(this.game.dealer[0].rank);

        let table: string;
        let row: number;
        if (cards.length === 2 && rankValue(cards[0].rank) === rankValue(cards[1].rank)) {
            table = 'pairs';
            row = rankValue(cards[0].rank);
        } else if (hv.soft && hv.total >= 13 && hv.total <= 20) {
            table = 'soft';
            row = hv.total;
        } else {
            table = 'hard';
            row = Math.min(17, Math.max(8, hv.total));
        }

        $(this.chartEl, `[data-table="${table}"][data-row="${row}"][data-col="${up}"]`)?.classList.add('cell--current');
    }
}
