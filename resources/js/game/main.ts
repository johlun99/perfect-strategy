import { Game } from './engine/game';
import { Table } from './ui/table';
import { getSelectedRuleset } from './ruleset-store';

const root = document.getElementById('table');
if (root) {
    const game = new Game({ startingChips: 1000, rules: getSelectedRuleset() });
    new Table(root, game);
}
