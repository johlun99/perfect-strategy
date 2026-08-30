import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSelectedRulesetId, setSelectedRulesetId, getSelectedRuleset, RULESETS } from './ruleset-store';

// Minimal in-memory localStorage so the store is testable in the node environment.
function fakeStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        clear: () => map.clear(),
    };
}

describe('ruleset-store', () => {
    beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));

    it('defaults to international', () => {
        expect(getSelectedRulesetId()).toBe('international');
        expect(getSelectedRuleset()).toBe(RULESETS.international);
    });

    it('round-trips a selection', () => {
        setSelectedRulesetId('cherry');
        expect(getSelectedRulesetId()).toBe('cherry');
        expect(getSelectedRuleset()).toBe(RULESETS.cherry);
    });

    it('falls back to the default for an unknown stored value', () => {
        localStorage.setItem('bj:ruleset', 'roulette');
        expect(getSelectedRulesetId()).toBe('international');
    });
});
