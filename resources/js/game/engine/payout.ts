import type { Card } from './card';
import { handValue, isBlackjack, isBust } from './hand';

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'surrender';

export interface Settlement {
    outcome: Outcome;
    /** Net change to the bankroll: amount returned minus the amount wagered. */
    net: number;
}

export interface SettleInput {
    player: Card[];
    dealer: Card[];
    bet: number;
    blackjackPayout: number;
    surrendered?: boolean;
    /** A hand produced by splitting: a two-card 21 counts as an ordinary 21. */
    fromSplit?: boolean;
}

export function settleHand(input: SettleInput): Settlement {
    const { player, dealer, bet, blackjackPayout, surrendered, fromSplit } = input;

    if (surrendered) {
        return { outcome: 'surrender', net: -bet / 2 };
    }

    const playerNatural = !fromSplit && isBlackjack(player);
    const dealerNatural = isBlackjack(dealer);

    if (playerNatural && dealerNatural) return { outcome: 'push', net: 0 };
    if (playerNatural) return { outcome: 'blackjack', net: Math.ceil(bet * blackjackPayout) };
    if (dealerNatural) return { outcome: 'lose', net: -bet };

    if (isBust(player)) return { outcome: 'lose', net: -bet };
    if (isBust(dealer)) return { outcome: 'win', net: bet };

    const playerTotal = handValue(player).total;
    const dealerTotal = handValue(dealer).total;

    if (playerTotal > dealerTotal) return { outcome: 'win', net: bet };
    if (playerTotal < dealerTotal) return { outcome: 'lose', net: -bet };
    return { outcome: 'push', net: 0 };
}

/** Insurance is a side bet paying 2:1 when the dealer shows a natural blackjack. */
export function settleInsurance(insuranceBet: number, dealerBlackjack: boolean): number {
    return dealerBlackjack ? insuranceBet * 2 : -insuranceBet;
}
