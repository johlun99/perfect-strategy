import { STANDARD_RULES, CHERRY_RULES, type Ruleset, type RulesetId } from './engine/rules';

/** The rulesets the toggle can select between. */
export const RULESETS: Record<RulesetId, Ruleset> = {
    international: STANDARD_RULES,
    cherry: CHERRY_RULES,
};

const STORAGE_KEY = 'bj:ruleset';
const DEFAULT_ID: RulesetId = 'international';

function isRulesetId(value: string | null): value is RulesetId {
    return value === 'international' || value === 'cherry';
}

/** The ruleset the player last chose, shared across both game modes. */
export function getSelectedRulesetId(): RulesetId {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isRulesetId(stored) ? stored : DEFAULT_ID;
    } catch {
        return DEFAULT_ID; // localStorage unavailable (private mode, etc.)
    }
}

export function setSelectedRulesetId(id: RulesetId): void {
    try {
        localStorage.setItem(STORAGE_KEY, id);
    } catch {
        // Non-fatal: the choice just won't persist.
    }
}

export function getSelectedRuleset(): Ruleset {
    return RULESETS[getSelectedRulesetId()];
}
