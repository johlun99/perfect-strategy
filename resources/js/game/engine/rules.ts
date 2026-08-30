/**
 * House rules. Fixed for V1 but shaped as a config object so a later settings
 * screen can drive it without touching engine logic.
 */
export interface Ruleset {
    numDecks: number;
    dealerHitsSoft17: boolean;
    blackjackPayout: number; // 1.5 = 3:2
    doubleAfterSplit: boolean;
    maxSplitHands: number; // total hands allowed after resplitting
    /** Split aces receive exactly one card each and cannot be hit further. */
    splitAcesOneCard: boolean;
    surrenderAllowed: boolean; // late surrender
    insuranceAllowed: boolean;
    penetration: number; // fraction of the shoe dealt before reshuffling
}

export const STANDARD_RULES: Ruleset = {
    numDecks: 6,
    dealerHitsSoft17: false,
    blackjackPayout: 1.5,
    doubleAfterSplit: true,
    maxSplitHands: 4,
    splitAcesOneCard: true,
    surrenderAllowed: true,
    insuranceAllowed: true,
    penetration: 0.75,
};
