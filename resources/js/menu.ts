import { SoundManager } from './game/ui/audio';
import { getSelectedRulesetId, setSelectedRulesetId } from './game/ruleset-store';
import type { RulesetId } from './game/engine/rules';

const sound = new SoundManager();
sound.preload(['click']);

document.querySelectorAll<HTMLElement>('[data-sound="click"]').forEach((el) => {
    el.addEventListener('click', () => sound.play('click'));
});

// --- ruleset selector ---------------------------------------------------
const HINTS: Record<RulesetId, string> = {
    international: 'Standard rules: blackjack pays 3:2, late surrender, ties push.',
    cherry: 'Cherry: dealer wins pushes on 17–19, double only on 7–11, no surrender, resplit aces.',
};

const opts = document.querySelectorAll<HTMLButtonElement>('.ruleset__opt[data-ruleset]');
const hint = document.getElementById('ruleset-hint');

function reflect(id: RulesetId): void {
    opts.forEach((btn) => {
        const active = btn.dataset.ruleset === id;
        btn.classList.toggle('ruleset__opt--active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
    if (hint) hint.textContent = HINTS[id];
}

if (opts.length) {
    reflect(getSelectedRulesetId());
    opts.forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.ruleset as RulesetId;
            setSelectedRulesetId(id);
            reflect(id);
        });
    });
}
