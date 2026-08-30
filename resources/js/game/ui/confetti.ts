export type ConfettiVariant = 'gold' | 'ash';

interface CelebrateOptions {
    count?: number;
    variant?: ConfettiVariant;
}

// gold = player win; ash = dealer-blackjack loss (same motion, darker palette).
const PALETTES: Record<ConfettiVariant, string[]> = {
    gold: ['#d4af37', '#f5e6a8', '#ffffff', '#1f9d4d', '#2a8a4d'],
    ash: ['#4a4a4a', '#6b6b6b', '#9aa0a6', '#b23a3a', '#1a1a1a'],
};

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The single fixed overlay that all particles live in; created on first use. */
function fxLayer(): HTMLElement {
    let layer = document.querySelector<HTMLElement>('.fx-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'fx-layer';
        document.body.append(layer);
    }
    return layer;
}

/**
 * Bursts confetti from `origin`'s center. Returns the spawned particles.
 * No-op (returns []) when the user prefers reduced motion. Each particle removes
 * itself on animationend and the overlay is dropped once the last one finishes.
 */
export function celebrate(origin: HTMLElement, opts: CelebrateOptions = {}): HTMLElement[] {
    if (prefersReducedMotion()) return [];

    const count = opts.count ?? 90;
    const variant = opts.variant ?? 'gold';
    const colors = PALETTES[variant];
    const layer = fxLayer();

    const rect = origin.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    const particles: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = `confetti confetti--${variant}`;
        const size = rand(6, 12);
        p.style.left = `${ox}px`;
        p.style.top = `${oy}px`;
        p.style.width = `${size}px`;
        p.style.height = `${size * rand(0.45, 1)}px`;
        p.style.background = pick(colors);
        p.style.setProperty('--dx', `${rand(-45, 45)}vw`);
        p.style.setProperty('--dy', `${rand(55, 100)}vh`);
        p.style.setProperty('--rot', `${rand(-720, 720)}deg`);
        p.style.setProperty('--delay', `${rand(0, 0.25)}s`);
        p.style.setProperty('--dur', `${rand(1.1, 1.9)}s`);
        p.addEventListener('animationend', () => {
            p.remove();
            if (!layer.querySelector('.confetti')) layer.remove();
        }, { once: true });
        layer.append(p);
        particles.push(p);
    }
    return particles;
}
