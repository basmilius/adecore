import { describe, expect, test } from 'bun:test';
import type { ProviderAccounts, ProviderAccountStatus, UsageLimitsProvider, UsageLimitsSnapshot } from '@adecore/agent-contracts';
import { continueTarget, continueTargets, hasUnreadAccount, limitsOfAccount } from './account-limits';

function status(id: string, state: ProviderAccountStatus['state'] = 'ready'): ProviderAccountStatus {
    return {
        id,
        kind: 'claude',
        state,
        email: null,
        plan: null,
        organization: null,
        home: '',
        message: null,
        checkedAt: 1
    };
}

const accounts: ProviderAccounts = {
    accounts: {
        claude: { kind: 'claude' },
        claude_work: { kind: 'claude', label: 'Work' },
        claude_home: { kind: 'claude', label: 'Home' },
        claude_off: { kind: 'claude', enabled: false },
        claude_out: { kind: 'claude' }
    },
    statuses: [status('claude'), status('claude_work'), status('claude_home'), status('claude_off'), status('claude_out', 'signed-out')]
};

function limits(id: string | null, session: number, weekly = 0.1, checkedAt = 5): UsageLimitsProvider {
    return {
        kind: 'claude',
        ...(id === null ? {} : { account: { id, label: id } }),
        plan: 'max',
        checkedAt,
        source: 'probe',
        windows: [
            { id: 'session', kind: 'session', label: 'Session', used: session, resetsAt: null, durationMs: null },
            { id: 'weekly', kind: 'weekly', label: 'Weekly', used: weekly, resetsAt: null, durationMs: null }
        ],
        cost: null,
        unavailable: null
    };
}

function snapshot(...providers: UsageLimitsProvider[]): UsageLimitsSnapshot {
    return { providers };
}

describe('going on under another account after a limit', () => {
    test('picks the account with the least of its session spent', () => {
        const read = snapshot(limits(null, 1), limits('claude_work', 0.6), limits('claude_home', 0.2));
        expect(continueTarget(accounts, read, 'claude', undefined)?.id).toBe('claude_home');
        expect(continueTarget(accounts, read, 'claude', 'claude_home')?.id).toBe('claude_work');
    });

    test('never one that is off, signed out, spent on any window, or not read yet', () => {
        const read = snapshot(
            limits(null, 1),
            limits('claude_work', 0.2, 1),
            limits('claude_home', 0.1, 0.1, 0),
            limits('claude_off', 0),
            limits('claude_out', 0)
        );
        expect(continueTarget(accounts, read, 'claude', undefined)).toBeNull();
        expect(continueTarget(accounts, null, 'claude', undefined)).toBeNull();
    });

    test('lists every account with room, the least spent first, and suggests the first', () => {
        const read = snapshot(limits(null, 0.4), limits('claude_work', 0.6), limits('claude_home', 0.2));
        const ids = (current: string | undefined): string[] => continueTargets(accounts, read, 'claude', current).map((entry) => entry.id);
        expect(ids('claude_out')).toEqual(['claude_home', 'claude', 'claude_work']);
        expect(ids(undefined)).toEqual(['claude_home', 'claude_work']);
        expect(continueTarget(accounts, read, 'claude', undefined)?.id).toBe(ids(undefined)[0]);
    });

    test('lists none that is off, signed out, spent on any window, or not read yet', () => {
        const read = snapshot(
            limits(null, 1),
            limits('claude_work', 0.2, 1),
            limits('claude_home', 0.1, 0.1, 0),
            limits('claude_off', 0),
            limits('claude_out', 0)
        );
        expect(continueTargets(accounts, read, 'claude', undefined)).toEqual([]);
        expect(continueTargets(accounts, null, 'claude', undefined)).toEqual([]);
        const someRoom = snapshot(
            limits(null, 1),
            limits('claude_work', 0.5),
            limits('claude_home', 0.1, 0.1, 0),
            limits('claude_off', 0),
            limits('claude_out', 0)
        );
        expect(continueTargets(accounts, someRoom, 'claude', undefined).map((entry) => entry.id)).toEqual(['claude_work']);
    });

    test('knows which accounts still need a read', () => {
        expect(hasUnreadAccount(accounts, snapshot(limits(null, 1), limits('claude_work', 0.2), limits('claude_home', 0.2, 0, 0)), 'claude', undefined)).toBe(
            true
        );
        expect(hasUnreadAccount(accounts, snapshot(limits(null, 1), limits('claude_work', 0.2), limits('claude_home', 0.2)), 'claude', undefined)).toBe(false);
    });

    test('an entry from a machine before accounts is the default account', () => {
        expect(limitsOfAccount(snapshot(limits(null, 0.5)), 'claude')?.windows[0]?.used).toBe(0.5);
    });
});
