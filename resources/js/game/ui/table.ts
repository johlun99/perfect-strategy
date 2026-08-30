import type { Game } from '../engine/game';
import { handValue, isBust, isBlackjack } from '../engine/hand';
import type { Card } from '../engine/card';
import { SoundManager } from './audio';
import { createCardEl, createFaceDownEl, revealFaceDown } from './cards';
import { celebrate } from './confetti';

const DENOMINATIONS = [5, 25, 100, 500];
const MIN_BET = 5;

const cardKey = (c: Card) => `${c.rank}${c.suit[0]}`;
const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;

/** Wires the blackjack engine to the DOM: renders state and plays sounds. */
export class Table {
    private sound = new SoundManager();
    private pendingBet = 0;
    private prevPlayerKeys: string[] = [];
    private holeEl: HTMLElement | null = null;
    private dealOrder = 0;
    private lastChips: number;

    private el: {
        dealerHand: HTMLElement; dealerTotal: HTMLElement;
        playerHands: HTMLElement; banner: HTMLElement;
        chips: HTMLElement; bet: HTMLElement;
        betControls: HTMLElement; actionControls: HTMLElement; insuranceControls: HTMLElement;
        chipRack: HTMLElement; deal: HTMLButtonElement; clearBet: HTMLElement; mute: HTMLElement;
    };

    constructor(root: HTMLElement, private game: Game) {
        this.el = {
            dealerHand: $(root, '#dealer-hand'),
            dealerTotal: $(root, '#dealer-total'),
            playerHands: $(root, '#player-hands'),
            banner: $(root, '#banner'),
            chips: $(root, '#chips'),
            bet: $(root, '#bet'),
            betControls: $(root, '#bet-controls'),
            actionControls: $(root, '#action-controls'),
            insuranceControls: $(root, '#insurance-controls'),
            chipRack: $(root, '#chip-rack'),
            deal: $(root, '#deal'),
            clearBet: $(root, '#clear-bet'),
            mute: $(root, '#mute'),
        };
        this.lastChips = game.bankroll.balance;

        this.sound.preload(['deal', 'flip', 'place', 'chip', 'chips-win', 'click', 'win', 'blackjack', 'lose', 'bust', 'push', 'shuffle']);
        this.buildChipRack();
        this.bindEvents();
        this.render();
    }

    // --- wiring ------------------------------------------------------------

    private bindEvents(): void {
        this.game.on('change', () => this.render());
        this.game.on('dealerReveal', () => this.render());
        this.game.on('roundEnded', () => this.onRoundEnded());
        this.game.on('shuffle', () => this.sound.play('shuffle'));

        this.el.deal.addEventListener('click', () => this.onDeal());
        this.el.clearBet.addEventListener('click', () => this.clearBet());
        this.el.mute.addEventListener('click', () => {
            const muted = this.sound.toggleMute();
            this.el.mute.textContent = muted ? '🔇' : '🔊';
        });

        this.el.actionControls.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
            btn.addEventListener('click', () => this.doAction(btn.dataset.action!));
        });
        this.el.insuranceControls.querySelectorAll<HTMLButtonElement>('[data-insurance]').forEach((btn) => {
            btn.addEventListener('click', () => this.doInsurance(btn.dataset.insurance === 'yes'));
        });
    }

    private buildChipRack(): void {
        for (const value of DENOMINATIONS) {
            const chip = document.createElement('button');
            chip.className = `chip chip--${value}`;
            chip.dataset.value = String(value);
            chip.innerHTML = `<span>${value}</span>`;
            chip.addEventListener('click', () => this.addChip(value));
            this.el.chipRack.append(chip);
        }
    }

    // --- betting actions ---------------------------------------------------

    private canBet(): boolean {
        return this.game.phase === 'betting' || this.game.phase === 'settled';
    }

    private addChip(value: number): void {
        if (!this.canBet()) return;
        if (!this.game.bankroll.canAfford(this.pendingBet + value)) return;
        this.pendingBet += value;
        this.sound.play('chip');
        this.render();
    }

    private clearBet(): void {
        if (!this.canBet()) return;
        this.pendingBet = 0;
        this.sound.play('click');
        this.render();
    }

    private onDeal(): void {
        if (!this.canBet() || this.pendingBet < MIN_BET) return;
        if (!this.game.bankroll.canAfford(this.pendingBet)) return;
        const bet = this.pendingBet;
        this.pendingBet = 0;
        this.resetTableDom();
        this.game.deal(bet);
    }

    private doAction(name: string): void {
        this.sound.play('click');
        try {
            (this.game as unknown as Record<string, () => void>)[name]();
        } catch {
            /* ignore illegal action */
        }
    }

    private doInsurance(take: boolean): void {
        this.sound.play('click');
        take ? this.game.takeInsurance() : this.game.declineInsurance();
    }

    // --- rendering ---------------------------------------------------------

    private resetTableDom(): void {
        this.el.dealerHand.innerHTML = '';
        this.el.playerHands.innerHTML = '';
        this.holeEl = null;
        this.prevPlayerKeys = [];
        this.el.banner.hidden = true;
        this.el.banner.classList.remove('banner--jackpot', 'banner--dealer-bj');
        this.el.dealerHand.classList.remove('hand--dealer-bj');
        this.el.dealerTotal.hidden = true;
    }

    private render(): void {
        this.dealOrder = 0;
        this.renderDealer();
        this.renderPlayers();
        this.renderDock();
    }

    private animateNew(el: HTMLElement): void {
        const order = this.dealOrder++;
        el.style.animationDelay = `${order * 0.11}s`;
        window.setTimeout(() => this.sound.play('deal'), order * 110);
        // Drop the dealing class once done: its fill:both keeps `transform`
        // pinned, which would otherwise block the hole-card flip transform.
        el.addEventListener('animationend', () => el.classList.remove('card--dealing'), { once: true });
    }

    private renderDealer(): void {
        const dealer = this.game.dealer;
        const revealed = this.game.phase === 'dealerTurn' || this.game.phase === 'settled';
        const existing = this.el.dealerHand.children;

        for (let i = 0; i < dealer.length; i++) {
            const current = existing[i] as HTMLElement | undefined;
            if (!current) {
                const el = i === 1 && !revealed ? createFaceDownEl() : createCardEl(dealer[i]);
                if (i === 1 && !revealed) this.holeEl = el;
                this.animateNew(el);
                this.el.dealerHand.append(el);
            } else if (current === this.holeEl && revealed && !current.classList.contains('revealed')) {
                revealFaceDown(current, dealer[1]);
                this.sound.play('flip');
            }
        }

        if (revealed) {
            this.el.dealerTotal.textContent = String(handValue(dealer).total);
            this.el.dealerTotal.hidden = false;
            if (this.game.phase === 'settled' && isBlackjack(dealer)) {
                this.el.dealerHand.classList.add('hand--dealer-bj');
            }
        }
    }

    private renderPlayers(): void {
        const pool = [...this.prevPlayerKeys];
        const consume = (key: string): boolean => {
            const idx = pool.indexOf(key);
            if (idx === -1) return false;
            pool.splice(idx, 1);
            return true;
        };

        this.el.playerHands.innerHTML = '';
        const flatKeys: string[] = [];

        this.game.hands.forEach((hand, j) => {
            const wrap = document.createElement('div');
            wrap.className = 'hand-wrap';

            const handEl = document.createElement('div');
            handEl.className = 'hand';
            const isActive = this.game.phase === 'playerTurn' && j === this.game.activeIndex;
            if (isActive) handEl.classList.add('hand--active');
            if (hand.settlement?.outcome === 'blackjack') handEl.classList.add('hand--blackjack');

            for (const card of hand.cards) {
                const key = cardKey(card);
                flatKeys.push(key);
                const isNew = !consume(key);
                const cardEl = createCardEl(card, isNew);
                if (isNew) this.animateNew(cardEl);
                handEl.append(cardEl);
            }
            wrap.append(handEl);

            const total = document.createElement('div');
            total.className = 'pill';
            total.textContent = String(handValue(hand.cards).total);
            wrap.append(total);

            const bet = document.createElement('div');
            bet.className = 'pill pill--bet';
            bet.textContent = `${hand.bet}`;
            wrap.append(bet);

            if (hand.settlement) {
                const res = document.createElement('div');
                const o = hand.settlement.outcome;
                const tone = o === 'blackjack' ? 'blackjack'
                    : o === 'push' ? 'push'
                    : hand.settlement.net > 0 ? 'win' : 'lose';
                res.className = `pill pill--result pill--${tone}`;
                res.textContent = o;
                wrap.append(res);
            }

            this.el.playerHands.append(wrap);
        });

        this.prevPlayerKeys = flatKeys;
    }

    private renderDock(): void {
        const g = this.game;
        const betting = this.canBet();

        this.el.chips.textContent = String(g.bankroll.balance);
        if (g.bankroll.balance !== this.lastChips) {
            this.el.chips.classList.remove('bump');
            void this.el.chips.offsetWidth; // restart animation
            this.el.chips.classList.add('bump');
            this.lastChips = g.bankroll.balance;
        }

        const placed = g.hands.reduce((s, h) => s + h.bet, 0) + g.insuranceBet;
        this.el.bet.textContent = String(betting ? this.pendingBet : placed);

        this.el.betControls.hidden = g.phase === 'playerTurn' || g.phase === 'insurance';
        this.el.actionControls.hidden = g.phase !== 'playerTurn';
        this.el.insuranceControls.hidden = g.phase !== 'insurance';

        this.el.deal.disabled = !(betting && this.pendingBet >= MIN_BET && g.bankroll.canAfford(this.pendingBet));

        this.el.chipRack.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip) => {
            const value = Number(chip.dataset.value);
            chip.disabled = !betting || !g.bankroll.canAfford(this.pendingBet + value);
        });

        const set = (action: string, ok: boolean) => {
            const btn = this.el.actionControls.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
            if (btn) btn.disabled = !ok;
        };
        set('hit', g.canHit());
        set('stand', g.canStand());
        set('double', g.canDouble());
        set('split', g.canSplit());
        set('surrender', g.canSurrender());
    }

    private onRoundEnded(): void {
        const results = this.game.results;
        const net = results.reduce((s, r) => s + r.net, 0);
        const anyBlackjack = results.some((r) => r.outcome === 'blackjack');
        const dealerBlackjack = isBlackjack(this.game.dealer);
        const anyBust = this.game.hands.some((h) => isBust(h.cards));

        let text: string;
        if (net > 0) {
            text = anyBlackjack ? 'Blackjack!' : 'You win';
            this.sound.play(anyBlackjack ? 'blackjack' : 'win');
            window.setTimeout(() => this.sound.play('chips-win'), 180);
            if (anyBlackjack) {
                this.el.banner.classList.add('banner--jackpot');
                this.sound.play('place');
                celebrate(this.el.playerHands, { variant: 'gold' });
            }
        } else if (net < 0) {
            text = dealerBlackjack ? 'Dealer Blackjack' : 'Dealer wins';
            this.sound.play(anyBust ? 'bust' : 'lose');
            if (dealerBlackjack) {
                this.el.banner.classList.add('banner--dealer-bj');
                celebrate(this.el.dealerHand, { variant: 'ash' });
            }
        } else {
            text = 'Push';
            this.sound.play('push');
        }

        const sign = net > 0 ? `+${net}` : net < 0 ? String(net) : '';
        this.el.banner.textContent = sign ? `${text}  ${sign}` : text;
        this.el.banner.hidden = false;

        this.pendingBet = 0;
        this.render();
    }
}
