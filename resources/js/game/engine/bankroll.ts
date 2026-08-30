/**
 * The player's chip balance. In-memory for V1; the small surface here
 * (balance / place / credit) is what a later persistence adapter will back.
 */
export class Bankroll {
    constructor(private chips: number) {}

    get balance(): number {
        return this.chips;
    }

    canAfford(amount: number): boolean {
        return amount <= this.chips;
    }

    /** Remove wagered chips from the balance. Throws if unaffordable. */
    place(amount: number): void {
        if (!this.canAfford(amount)) {
            throw new Error(`Cannot place ${amount}: balance is ${this.chips}`);
        }
        this.chips -= amount;
    }

    /** Return chips to the balance (winnings and/or returned stake). */
    credit(amount: number): void {
        this.chips += amount;
    }
}
