import { Game } from './engine/game';
import { Table } from './ui/table';

const root = document.getElementById('table');
if (root) {
    const game = new Game({ startingChips: 1000 });
    new Table(root, game);
}
