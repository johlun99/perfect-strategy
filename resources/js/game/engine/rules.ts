/**
 * House rules, shaped as a config object so the settings toggle can swap whole
 * rulesets without touching engine logic.
 */
export type RulesetId = 'international' | 'cherry';

export interface Ruleset {
    id: RulesetId;
    label: string;
    numDecks: number;
    dealerHitsSoft17: boolean;
    blackjackPayout: number; // 1.5 = 3:2
    /** Allowed two-card totals for doubling (ace as 1); null = any two cards. */
    doubleTotals: number[] | null;
    doubleAfterSplit: boolean;
    maxSplitHands: number; // total hands allowed after resplitting
    /** Split aces receive exactly one card each and cannot be hit further. */
    splitAcesOneCard: boolean;
    /** A pair of aces produced by splitting may itself be split again. */
    resplitAces: boolean;
    surrenderAllowed: boolean; // late surrender
    insuranceAllowed: boolean;
    /** Dealer wins pushes on 17/18/19 (a Cherry oddity); 20/21 still push. */
    dealerWinsLowTies: boolean;
    penetration: number; // fraction of the shoe dealt before reshuffling
}

export const STANDARD_RULES: Ruleset = {
    id: 'international',
    label: 'International',
    numDecks: 6,
    dealerHitsSoft17: false,
    blackjackPayout: 1.5,
    doubleTotals: null,
    doubleAfterSplit: true,
    maxSplitHands: 4,
    splitAcesOneCard: true,
    resplitAces: false,
    surrenderAllowed: true,
    insuranceAllowed: true,
    dealerWinsLowTies: false,
    penetration: 0.75,
};

/**
 * Swedish casino "Cherry" rules (https://cherry.se/spelregler). Differences from
 * the international set: the dealer wins pushes on 17/18/19, doubling is limited
 * to two-card totals of 7–11, no double-after-split, no surrender, and splitting
 * is unlimited including resplitting aces.
 */
export const CHERRY_RULES: Ruleset = {
    id: 'cherry',
    label: 'Cherry',
    numDecks: 6,
    dealerHitsSoft17: false,
    blackjackPayout: 1.5,
    doubleTotals: [7, 8, 9, 10, 11],
    doubleAfterSplit: false,
    maxSplitHands: Infinity,
    splitAcesOneCard: true,
    resplitAces: true,
    surrenderAllowed: false,
    insuranceAllowed: true,
    dealerWinsLowTies: true,
    penetration: 0.75,
};
