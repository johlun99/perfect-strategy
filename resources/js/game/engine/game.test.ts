import { describe, it, expect } from 'vitest';
import { Game } from './game';
import type { CardSource } from './shoe';
import type { Card, Rank } from './card';
import { handValue } from './hand';
import { CHERRY_RULES } from './rules';

const c = (rank: Rank): Card => ({ rank, suit: 'spades' });

/** A rigged, deterministic card source: draws the given ranks in order. */
function stack(...ranks: Rank[]): CardSource {
    const cards = ranks.map(c);
    let i = 0;
    return {
        draw: () => cards[i++],
        needsShuffle: () => false,
        reshuffle: () => { i = 0; },
    };
}

// Deal order is player, dealer, player, dealer — so ranks are interleaved.
const newGame = (source: CardSource, chips = 1000) =>
    new Game({ source, startingChips: chips });

const cherryGame = (source: CardSource, chips = 1000) =>
    new Game({ source, startingChips: chips, rules: CHERRY_RULES });

describe('Game — dealing', () => {
    it('deals two cards each and opens the player turn', () => {
        const g = newGame(stack('10', '10', '9', '7')); // player 10,9 / dealer 10,7
        g.deal(10);
        expect(g.phase).toBe('playerTurn');
        expect(g.hands[0].cards.map((x) => x.rank)).toEqual(['10', '9']);
        expect(g.dealer.map((x) => x.rank)).toEqual(['10', '7']);
        expect(g.bankroll.balance).toBe(990); // bet placed
    });
});

describe('Game — stand / win / lose', () => {
    it('pays a win when the player out-totals a standing dealer', () => {
        const g = newGame(stack('10', '10', '9', '7')); // player 19 vs dealer 17
        g.deal(10);
        g.stand();
        expect(g.phase).toBe('settled');
        expect(g.results[0].outcome).toBe('win');
        expect(g.bankroll.balance).toBe(1010);
    });

    it('loses when the player busts on a hit', () => {
        const g = newGame(stack('10', '10', '6', '8', '10')); // player 16 -> +10 = 26; dealer 18
        g.deal(10);
        g.hit();
        expect(g.results[0].outcome).toBe('lose');
        expect(g.bankroll.balance).toBe(990);
    });
});

describe('Game — blackjacks', () => {
    it('pays a natural blackjack immediately at 3:2', () => {
        const g = newGame(stack('A', '10', 'K', '7')); // player A,K vs dealer 10,7
        g.deal(10);
        expect(g.phase).toBe('settled');
        expect(g.results[0].outcome).toBe('blackjack');
        expect(g.bankroll.balance).toBe(1015);
    });

    it('offers insurance on a dealer ace and pays it when the dealer has blackjack', () => {
        const g = newGame(stack('10', 'A', '9', 'K')); // player 19 vs dealer A,K (blackjack)
        g.deal(10);
        expect(g.phase).toBe('insurance');
        g.takeInsurance();
        expect(g.phase).toBe('settled');
        expect(g.results[0].outcome).toBe('lose');
        // Lost 10 on the hand, won 10 on insurance -> back to even.
        expect(g.bankroll.balance).toBe(1000);
    });

    it('declining insurance against a dealer blackjack just loses the hand', () => {
        const g = newGame(stack('10', 'A', '9', 'K'));
        g.deal(10);
        g.declineInsurance();
        expect(g.results[0].outcome).toBe('lose');
        expect(g.bankroll.balance).toBe(990);
    });
});

describe('Game — double down', () => {
    it('doubles the bet, draws one card, and ends the hand', () => {
        const g = newGame(stack('5', '10', '6', '7', '9')); // player 11 -> +9 = 20; dealer 17
        g.deal(10);
        expect(g.canDouble()).toBe(true);
        g.double();
        expect(g.hands[0].cards).toHaveLength(3);
        expect(g.results[0].outcome).toBe('win');
        expect(g.bankroll.balance).toBe(1020); // net +20
    });
});

describe('Game — split', () => {
    it('splits a pair into two independently-bet hands', () => {
        const g = newGame(stack('8', '10', '8', '7', 'A', '9')); // pair 8s; draws A then 9
        g.deal(10);
        expect(g.canSplit()).toBe(true);
        g.split();
        expect(g.hands).toHaveLength(2);
        expect(g.hands[0].cards.map((x) => x.rank)).toEqual(['8', 'A']); // 19
        expect(g.hands[1].cards.map((x) => x.rank)).toEqual(['8', '9']); // 17
        expect(g.bankroll.balance).toBe(980); // two bets of 10 placed
        g.stand(); // hand 0 (19) stands
        g.stand(); // hand 1 (17) stands vs dealer 17
        expect(g.results).toHaveLength(2);
        expect(g.results[0].outcome).toBe('win');  // 19 vs 17
        expect(g.results[1].outcome).toBe('push'); // 17 vs 17
        expect(g.bankroll.balance).toBe(1010);
    });

    it('gives split aces exactly one card each and auto-completes them', () => {
        const g = newGame(stack('A', '10', 'A', '7', 'K', '9')); // split aces; draw K then 9
        g.deal(10);
        g.split();
        expect(g.phase).toBe('settled'); // both hands auto-stood
        expect(g.hands[0].cards).toHaveLength(2);
        expect(g.hands[1].cards).toHaveLength(2);
        // A,K from a split is 21 but NOT a blackjack -> normal win vs dealer 17
        expect(g.results[0].outcome).toBe('win');
        expect(g.results[1].outcome).toBe('win');
    });
});

describe('Game — surrender', () => {
    it('returns half the bet on late surrender', () => {
        const g = newGame(stack('10', '10', '6', '7')); // player 16 vs dealer 17
        g.deal(10);
        expect(g.canSurrender()).toBe(true);
        g.surrender();
        expect(g.results[0].outcome).toBe('surrender');
        expect(g.bankroll.balance).toBe(995);
    });

    it('cannot surrender after taking a hit', () => {
        const g = newGame(stack('10', '10', '2', '7', '3'));
        g.deal(10);
        g.hit();
        expect(g.canSurrender()).toBe(false);
    });
});

describe('Game — dealer play', () => {
    it('draws until reaching 17', () => {
        const g = newGame(stack('10', '10', '10', '6', 'A')); // dealer 16 -> draws A -> 17
        g.deal(10);
        g.stand();
        expect(handValue(g.dealer).total).toBe(17);
        expect(g.results[0].outcome).toBe('win'); // player 20
    });

    it('stands on a soft 17 under standard rules', () => {
        const g = newGame(stack('10', '6', '10', 'A')); // dealer 6,A = soft 17, upcard 6
        g.deal(10);
        g.stand();
        expect(g.dealer).toHaveLength(2); // did not draw
        expect(handValue(g.dealer)).toEqual({ total: 17, soft: true });
        expect(g.results[0].outcome).toBe('win');
    });
});

describe('Game — Cherry rules', () => {
    it('loses a tied 18 to the dealer', () => {
        const g = cherryGame(stack('10', '10', '8', '8')); // player 18 vs dealer 18
        g.deal(10);
        g.stand();
        expect(g.results[0].outcome).toBe('lose');
        expect(g.bankroll.balance).toBe(990);
    });

    it('restricts doubling to two-card totals of 7–11', () => {
        // p1, d1, p2, d2 -> player is the two non-dealer cards.
        const canDouble = (p1: Rank, p2: Rank) => {
            const g = cherryGame(stack(p1, '10', p2, '7'));
            g.deal(10);
            return g.canDouble();
        };
        expect(canDouble('5', '6')).toBe(true);  // hard 11
        expect(canDouble('10', '2')).toBe(false); // hard 12
        expect(canDouble('A', '6')).toBe(true);  // soft 17 -> ace as 1 -> 7
        expect(canDouble('A', '2')).toBe(false); // soft 13 -> hard 3
    });

    it('never offers surrender', () => {
        const g = cherryGame(stack('10', '10', '6', '7')); // 16 vs 17
        g.deal(10);
        expect(g.canSurrender()).toBe(false);
    });

    it('allows resplitting aces and settles every hand', () => {
        // player A,A vs dealer 10,7; split draws A,9 then resplit draws 9,9
        const g = cherryGame(stack('A', '10', 'A', '7', 'A', '9', '9', '9'));
        g.deal(10);
        g.split();
        expect(g.phase).toBe('playerTurn'); // the A,A hand stayed live
        expect(g.canSplit()).toBe(true);
        g.split();
        expect(g.hands).toHaveLength(3);
        expect(g.phase).toBe('settled'); // all one-card ace hands auto-complete
        expect(g.results.every((r) => r.outcome === 'win')).toBe(true); // three A,9 (20) vs 17
    });

    it('does not cap the number of split hands at 4', () => {
        const eights = stack('8', '10', '8', '7', '8', '8', '8', '8', '8', '8');
        const g = cherryGame(eights);
        g.deal(10);
        g.split(); g.split(); g.split(); // -> four hands of 8,8
        expect(g.hands).toHaveLength(4);
        expect(g.canSplit()).toBe(true); // still splittable under Cherry
    });

    it('caps split hands at 4 under international rules', () => {
        const eights = stack('8', '10', '8', '7', '8', '8', '8', '8', '8', '8');
        const g = newGame(eights);
        g.deal(10);
        g.split(); g.split(); g.split();
        expect(g.hands).toHaveLength(4);
        expect(g.canSplit()).toBe(false);
    });
});
