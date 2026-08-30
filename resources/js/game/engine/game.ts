import type { Card } from './card';
import { rankValue } from './card';
import { handValue, isBlackjack, isBust } from './hand';
import { Shoe, type CardSource } from './shoe';
import { type Rng } from './rng';
import { Bankroll } from './bankroll';
import { settleHand, settleInsurance, type Settlement } from './payout';
import { STANDARD_RULES, type Ruleset } from './rules';

export type Phase = 'betting' | 'insurance' | 'playerTurn' | 'dealerTurn' | 'settled';

export interface PlayerHand {
    cards: Card[];
    bet: number;
    doubled: boolean;
    surrendered: boolean;
    fromSplit: boolean;
    isSplitAce: boolean;
    done: boolean;
    settlement?: Settlement;
}

export type GameEvent =
    | 'change'
    | 'shuffle'
    | 'dealerReveal'
    | 'roundEnded';

export interface GameOptions {
    rules?: Ruleset;
    rng?: Rng;
    source?: CardSource;
    startingChips?: number;
}

type Handler = () => void;

export class Game {
    readonly rules: Ruleset;
    readonly bankroll: Bankroll;
    private readonly source: CardSource;

    private _phase: Phase = 'betting';
    private _dealer: Card[] = [];
    private _hands: PlayerHand[] = [];
    private _active = 0;
    private _insuranceBet = 0;

    private handlers: Map<GameEvent, Handler[]> = new Map();

    constructor(opts: GameOptions = {}) {
        this.rules = opts.rules ?? STANDARD_RULES;
        this.bankroll = new Bankroll(opts.startingChips ?? 1000);
        const rng: Rng = opts.rng ?? (() => Math.random());
        this.source = opts.source ?? new Shoe(this.rules.numDecks, rng, this.rules.penetration);
    }

    // --- state getters -----------------------------------------------------

    get phase(): Phase { return this._phase; }
    get dealer(): Card[] { return this._dealer; }
    get hands(): PlayerHand[] { return this._hands; }
    get activeIndex(): number { return this._active; }
    get insuranceBet(): number { return this._insuranceBet; }

    get activeHand(): PlayerHand | null {
        return this._phase === 'playerTurn' ? this._hands[this._active] : null;
    }

    get results(): Settlement[] {
        return this._phase === 'settled'
            ? this._hands.map((h) => h.settlement!).filter(Boolean)
            : [];
    }

    // --- events ------------------------------------------------------------

    on(event: GameEvent, handler: Handler): void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        this.handlers.set(event, list);
    }

    private emit(event: GameEvent): void {
        for (const h of this.handlers.get(event) ?? []) h();
    }

    // --- legal moves for the active hand -----------------------------------

    canHit(): boolean {
        const h = this.activeHand;
        if (!h || h.done) return false;
        // A split ace that hasn't been resplit gets its one card only.
        if (h.isSplitAce && this.rules.splitAcesOneCard) return false;
        return true;
    }

    canStand(): boolean {
        const h = this.activeHand;
        return !!h && !h.done;
    }

    canDouble(): boolean {
        const h = this.activeHand;
        if (!h || h.done || h.cards.length !== 2) return false;
        if (h.fromSplit && !this.rules.doubleAfterSplit) return false;
        if (this.rules.doubleTotals) {
            const { total, soft } = handValue(h.cards);
            const hardTotal = soft ? total - 10 : total; // ace as 1
            if (!this.rules.doubleTotals.includes(hardTotal)) return false;
        }
        return this.bankroll.canAfford(h.bet);
    }

    canSplit(): boolean {
        const h = this.activeHand;
        if (!h || h.done || h.cards.length !== 2) return false;
        if (rankValue(h.cards[0].rank) !== rankValue(h.cards[1].rank)) return false;
        if (this._hands.length >= this.rules.maxSplitHands) return false;
        return this.bankroll.canAfford(h.bet);
    }

    canSurrender(): boolean {
        const h = this.activeHand;
        if (!this.rules.surrenderAllowed) return false;
        if (!h || h.done || h.cards.length !== 2) return false;
        return this._hands.length === 1 && !h.fromSplit && this._active === 0;
    }

    // --- actions -----------------------------------------------------------

    deal(bet: number): void {
        if (this._phase !== 'betting' && this._phase !== 'settled') {
            throw new Error(`Cannot deal during phase ${this._phase}`);
        }
        if (this.source.needsShuffle()) {
            this.source.reshuffle();
            this.emit('shuffle');
        }

        this.bankroll.place(bet);
        this._dealer = [];
        this._insuranceBet = 0;
        this._active = 0;
        const hand = this.newHand(bet, false, false);
        this._hands = [hand];

        hand.cards.push(this.source.draw());
        this._dealer.push(this.source.draw());
        hand.cards.push(this.source.draw());
        this._dealer.push(this.source.draw());

        this.resolveAfterDeal();
    }

    takeInsurance(): void {
        this.requirePhase('insurance');
        const insurance = Math.floor(this._hands[0].bet / 2);
        if (this.bankroll.canAfford(insurance)) {
            this.bankroll.place(insurance);
            this._insuranceBet = insurance;
        }
        this.peekAndStart();
    }

    declineInsurance(): void {
        this.requirePhase('insurance');
        this._insuranceBet = 0;
        this.peekAndStart();
    }

    hit(): void {
        if (!this.canHit()) throw new Error('Cannot hit');
        const h = this._hands[this._active];
        h.cards.push(this.source.draw());
        if (isBust(h.cards) || handValue(h.cards).total === 21) {
            this.completeHand();
        } else {
            this.emit('change');
        }
    }

    stand(): void {
        if (!this.canStand()) throw new Error('Cannot stand');
        this.completeHand();
    }

    double(): void {
        if (!this.canDouble()) throw new Error('Cannot double');
        const h = this._hands[this._active];
        this.bankroll.place(h.bet);
        h.bet *= 2;
        h.doubled = true;
        h.cards.push(this.source.draw());
        this.completeHand();
    }

    split(): void {
        if (!this.canSplit()) throw new Error('Cannot split');
        const h = this._hands[this._active];
        const base = h.bet;
        this.bankroll.place(base);

        const moved = h.cards.pop()!;
        const splitting_aces = h.cards[0].rank === 'A';
        h.fromSplit = true;
        h.isSplitAce = splitting_aces;

        const newHand = this.newHand(base, true, splitting_aces);
        newHand.cards.push(moved);
        this._hands.splice(this._active + 1, 0, newHand);

        h.cards.push(this.source.draw());
        newHand.cards.push(this.source.draw());

        if (splitting_aces && this.rules.splitAcesOneCard) {
            // Each split ace takes exactly one card, unless it drew another ace
            // and the rules allow resplitting it (Cherry) — then it stays live.
            this.completeSplitAce(h);
            this.completeSplitAce(newHand);
            this.advance();
        } else {
            this.emit('change');
        }
    }

    /** Mark a one-card split ace done, unless it can still be resplit. */
    private completeSplitAce(h: PlayerHand): void {
        const canResplit =
            this.rules.resplitAces &&
            h.cards.length === 2 &&
            h.cards[1].rank === 'A' &&
            this._hands.length < this.rules.maxSplitHands;
        if (!canResplit) h.done = true;
    }

    surrender(): void {
        if (!this.canSurrender()) throw new Error('Cannot surrender');
        const h = this._hands[this._active];
        h.surrendered = true;
        this.completeHand();
    }

    // --- internals ---------------------------------------------------------

    private newHand(bet: number, fromSplit: boolean, isSplitAce: boolean): PlayerHand {
        return { cards: [], bet, doubled: false, surrendered: false, fromSplit, isSplitAce, done: false };
    }

    private requirePhase(phase: Phase): void {
        if (this._phase !== phase) throw new Error(`Expected phase ${phase}, was ${this._phase}`);
    }

    private resolveAfterDeal(): void {
        if (this._dealer[0].rank === 'A' && this.rules.insuranceAllowed) {
            this._phase = 'insurance';
            this.emit('change');
            return;
        }
        this.peekAndStart();
    }

    private peekAndStart(): void {
        const dealerNatural = isBlackjack(this._dealer);
        const playerNatural = isBlackjack(this._hands[0].cards);
        if (dealerNatural || playerNatural) {
            this.settleAll();
            return;
        }
        this._phase = 'playerTurn';
        this._active = 0;
        this.emit('change');
    }

    private completeHand(): void {
        this._hands[this._active].done = true;
        this.advance();
    }

    private advance(): void {
        for (let i = this._active; i < this._hands.length; i++) {
            if (!this._hands[i].done) {
                this._active = i;
                this.emit('change');
                return;
            }
        }
        this.toDealer();
    }

    private toDealer(): void {
        this._phase = 'dealerTurn';
        this.emit('dealerReveal');

        const anyLive = this._hands.some((h) => !h.surrendered && !isBust(h.cards));
        if (anyLive) this.dealerPlay();

        this.settleAll();
    }

    private dealerPlay(): void {
        for (;;) {
            const { total, soft } = handValue(this._dealer);
            const mustHit = total < 17 || (total === 17 && soft && this.rules.dealerHitsSoft17);
            if (!mustHit) break;
            this._dealer.push(this.source.draw());
        }
    }

    private settleAll(): void {
        for (const h of this._hands) {
            h.settlement = settleHand({
                player: h.cards,
                dealer: this._dealer,
                bet: h.bet,
                blackjackPayout: this.rules.blackjackPayout,
                surrendered: h.surrendered,
                fromSplit: h.fromSplit,
                dealerWinsLowTies: this.rules.dealerWinsLowTies,
            });
            this.bankroll.credit(h.bet + h.settlement.net);
        }

        if (this._insuranceBet > 0) {
            const net = settleInsurance(this._insuranceBet, isBlackjack(this._dealer));
            this.bankroll.credit(this._insuranceBet + net);
        }

        this._phase = 'settled';
        this.emit('change');
        this.emit('roundEnded');
    }
}
