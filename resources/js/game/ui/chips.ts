/** Sounds the tray drives itself, tied to chip motion. A subset of SoundName. */
export type MarkSound = 'chip-slide' | 'chip-stack' | 'chip-clirr';

const CHIP_SIZE = 44; // px; keep in sync with .mark in game.css
const STACK_STEP = 7; // vertical gap between stacked chips

interface Mark {
    el: HTMLElement;
    value: number;
}

function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const centerOf = (el: HTMLElement): { x: number; y: number } => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** The single persistent overlay that all chip tokens live in; kept apart from
 *  the confetti `.fx-layer` so celebration cleanup never removes standing chips. */
function markLayer(): HTMLElement {
    let layer = document.querySelector<HTMLElement>('.mark-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'mark-layer';
        document.body.append(layer);
    }
    return layer;
}

/**
 * Manages physical chip ("mark") tokens for one bet spot: chips slide out of the
 * rack into a stack, then travel to the bank (win/push) or the dealer (loss).
 * Pure DOM + CSS-keyframe motion, mirroring the confetti approach.
 */
export class MarkTray {
    private stack: Mark[] = [];

    constructor(private play: (name: MarkSound) => void = () => {}) {}

    size(): number {
        return this.stack.length;
    }

    total(): number {
        return this.stack.reduce((s, m) => s + m.value, 0);
    }

    /** Spawn a chip of `value`, slide it from `from` onto the stack over `spot`. */
    place(value: number, from: HTMLElement, spot: HTMLElement): void {
        const el = document.createElement('div');
        el.className = `mark mark--${value}`;
        el.dataset.value = String(value);
        markLayer().append(el);
        this.stack.push({ el, value });
        this.settle(el, spot, this.stack.length - 1);

        if (prefersReducedMotion()) {
            this.play('chip-stack');
            return;
        }

        const target = centerOf(spot);
        const src = centerOf(from);
        el.style.setProperty('--from-x', `${src.x - target.x}px`);
        el.style.setProperty('--from-y', `${src.y - target.y - (this.stack.length - 1) * STACK_STEP}px`);
        el.classList.add('mark--sliding');
        this.play('chip-slide');
        el.addEventListener('animationend', () => {
            el.classList.remove('mark--sliding');
            this.play('chip-stack');
        }, { once: true });
    }

    /** Reposition standing chips over `spot` after the table layout shifts. */
    reflow(spot: HTMLElement): void {
        this.stack.forEach((m, i) => this.settle(m.el, spot, i));
    }

    /** Discard the pending stack (Clear button). */
    clear(): void {
        this.dismiss(this.take(), (el) => el.classList.add('mark--clearing'));
    }

    /** Slide the whole stack into the bank counter (win / push). */
    toBank(spot: HTMLElement, bank: HTMLElement): void {
        if (!this.stack.length) return;
        this.play('chip-clirr');
        this.travel(this.take(), spot, bank, 'mark--to-bank');
    }

    /** Slide the whole stack up to the dealer (loss). */
    toDealer(spot: HTMLElement, dealer: HTMLElement): void {
        if (!this.stack.length) return;
        this.travel(this.take(), spot, dealer, 'mark--to-dealer');
    }

    // --- internals ---------------------------------------------------------

    /** Empty the tracked stack, returning the tokens for teardown animation. */
    private take(): HTMLElement[] {
        const els = this.stack.map((m) => m.el);
        this.stack = [];
        return els;
    }

    /** Park a chip at its resting spot; stack offset lifts each chip a little. */
    private settle(el: HTMLElement, spot: HTMLElement, index: number): void {
        const c = centerOf(spot);
        el.style.left = `${c.x - CHIP_SIZE / 2}px`;
        el.style.top = `${c.y - CHIP_SIZE / 2 - index * STACK_STEP}px`;
    }

    private travel(els: HTMLElement[], from: HTMLElement, to: HTMLElement, cls: string): void {
        if (prefersReducedMotion()) {
            for (const el of els) el.remove();
            return;
        }
        const src = centerOf(from);
        const dst = centerOf(to);
        this.dismiss(els, (el) => {
            el.style.setProperty('--to-x', `${dst.x - src.x}px`);
            el.style.setProperty('--to-y', `${dst.y - src.y}px`);
            el.classList.add(cls);
        });
    }

    private dismiss(els: HTMLElement[], apply: (el: HTMLElement) => void): void {
        if (prefersReducedMotion()) {
            for (const el of els) el.remove();
            return;
        }
        for (const el of els) {
            apply(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
        }
    }
}
