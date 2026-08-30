export type SoundName =
    | 'deal' | 'flip' | 'place' | 'shuffle'
    | 'chip' | 'chips-win'
    | 'click' | 'win' | 'blackjack' | 'lose' | 'bust' | 'push' | 'wrong';

const VOLUMES: Partial<Record<SoundName, number>> = {
    deal: 0.6, flip: 0.6, place: 0.5, shuffle: 0.7,
    chip: 0.7, 'chips-win': 0.8,
    click: 0.5, win: 0.7, blackjack: 0.9, lose: 0.6, bust: 0.7, push: 0.5, wrong: 0.5,
};

/**
 * Tiny sound manager over HTMLAudioElement. Preloads one element per sound and
 * clones it on play so overlapping calls (rapid deals) don't cut each other off.
 */
export class SoundManager {
    private cache = new Map<SoundName, HTMLAudioElement>();
    private muted = false;

    constructor(private base = '/assets/audio') {}

    preload(names: SoundName[]): void {
        for (const name of names) this.element(name);
    }

    play(name: SoundName): void {
        if (this.muted) return;
        const node = this.element(name).cloneNode() as HTMLAudioElement;
        node.volume = VOLUMES[name] ?? 0.6;
        // Autoplay can reject before the first user gesture; ignore that.
        node.play().catch(() => {});
    }

    toggleMute(): boolean {
        this.muted = !this.muted;
        return this.muted;
    }

    private element(name: SoundName): HTMLAudioElement {
        let el = this.cache.get(name);
        if (!el) {
            el = new Audio(`${this.base}/${name}.ogg`);
            el.preload = 'auto';
            this.cache.set(name, el);
        }
        return el;
    }
}
