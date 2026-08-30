import { Game } from './engine/game';
import { Table } from './ui/table';
import { StrategyCoach } from './ui/coach';

const root = document.getElementById('table');
if (root) {
    const game = new Game({ startingChips: 1000 });
    new Table(root, game);
    new StrategyCoach(root, game);
}
