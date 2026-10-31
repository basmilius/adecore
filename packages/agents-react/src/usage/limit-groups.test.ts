import { describe, expect, test } from 'bun:test';
import type { ProviderAccounts, ProviderAccountStatus, UsageLimitsProvider, UsageWindow } from '@adecore/agent-contracts';
import { checkedLabel, emptyWindows, explain, hasSeveralAccounts, limitGroups, noteIsWarning, paceText, ringWindows, type LimitAccount } from './limit-groups';

function status(id: string, kind: string, state: ProviderAccountStatus['state'] = 'ready'): ProviderAccountStatus {
    return {
        id,
        kind,
        state,
        email: null,
        plan: null,
        organization: null,
        home: '',
        message: null,
        checkedAt: 1
    };
}

function entry(kind: 'claude' | 'codex' | 'nanogpt', account?: { id: string; label: string }, extra: Partial<UsageLimitsProvider> = {}): UsageLimitsProvider {
    return {
        kind,
        ...(account === undefined ? {} : { account }),
        plan: null,
        checkedAt: 5,
        source: 'probe',
        windows: [],
        cost: null,
        unavailable: null,
        ...extra
    };
}

function window(id: string, resetsAt: number | null): UsageWindow {
    return { id, kind: 'session', label: id, used: 0.2, resetsAt, durationMs: null };
}

describe('limits per account', () => {
    const accounts: ProviderAccounts = {
        accounts: {
            claude: { kind: 'claude' },
            claude_work: { kind: 'claude', label: 'Work', color: 'blue' },
            claude_out: { kind: 'claude', label: 'Out' },
            claude_off: { kind: 'claude', label: 'Off', enabled: false },
            codex: { kind: 'codex' }
        },
        statuses: [
            status('claude', 'claude'),
            status('claude_work', 'claude'),
            status('claude_out', 'claude', 'signed-out'),
            status('claude_off', 'claude', 'signed-out'),
            status('codex', 'codex')
        ]
    };

    test('a CLI lists what the machine read and the accounts it does not read that are on, in the order of the accounts', () => {
        const groups = limitGroups(
            { providers: [entry('claude', { id: 'claude', label: 'Claude Code' }), entry('claude', { id: 'claude_work', label: 'Old name' }), entry('codex')] },
            accounts
        );

        expect(groups.map((group) => [group.kind, group.accounts.map((account) => account.id)])).toEqual([
            ['claude', ['claude', 'claude_out', 'claude_work']],
            ['codex', ['codex']]
        ]);

        const work = groups[0]!.accounts[2]!;
        expect([work.name, work.color, work.status?.state]).toEqual(['Work', 'blue', 'ready']);
        const out = groups[0]!.accounts[1]!;
        expect([out.entry, out.status?.state]).toEqual([null, 'signed-out']);
        expect(hasSeveralAccounts(groups)).toBe(true);
    });

    test('a person who put an account on top sees it on top here too', () => {
        const ordered: ProviderAccounts = { ...accounts, accounts: { ...accounts.accounts, claude_work: { ...accounts.accounts.claude_work!, order: 0 } } };
        const groups = limitGroups(
            { providers: [entry('claude', { id: 'claude', label: 'Claude Code' }), entry('claude', { id: 'claude_work', label: 'Work' })] },
            ordered
        );
        expect(groups[0]!.accounts.map((account) => account.id)).toEqual(['claude_work', 'claude', 'claude_out']);
    });

    test('a CLI the machine reads no plan of has no group, even with an account that is on', () => {
        const withGrok: ProviderAccounts = { ...accounts, accounts: { ...accounts.accounts, grok: { kind: 'grok' } } };
        expect(limitGroups({ providers: [entry('codex')] }, withGrok).map((group) => group.kind)).toEqual(['codex']);
    });

    test('an account that is off is left out, also when the machine still read it', () => {
        const groups = limitGroups(
            { providers: [entry('claude', { id: 'claude', label: 'Claude Code' }), entry('claude', { id: 'claude_off', label: 'Off' })] },
            accounts
        );
        expect(groups[0]!.accounts.map((account) => account.id)).toEqual(['claude', 'claude_out', 'claude_work']);
    });

    test('a CLI that is not installed on the machine has no group', () => {
        const missing = entry('codex', undefined, { unavailable: { reason: 'not-installed', message: null } });
        expect(limitGroups({ providers: [entry('claude'), missing] }, null).map((group) => group.kind)).toEqual(['claude']);
    });

    test('a machine from before accounts has one row per CLI, named after it', () => {
        const groups = limitGroups({ providers: [entry('claude'), entry('codex')] }, null);
        expect(groups.map((group) => group.accounts.map((account) => account.name))).toEqual([['Claude Code'], ['Codex']]);
        expect(hasSeveralAccounts(groups)).toBe(false);
    });
});

describe('a provider with no CLI', () => {
    test('is a group of its own, named after the provider, with no account to sign in to', () => {
        const groups = limitGroups({ providers: [entry('nanogpt', undefined, { plan: 'Subscription', windows: [window('weekly_input', 900)] })] }, null);
        expect(groups.map((group) => [group.kind, group.accounts.map((account) => account.name)])).toEqual([['nanogpt', ['NanoGPT']]]);
    });

    test('says why it has no numbers in its own words when it has some, and in the usual ones when it has none', () => {
        const withWords = entry('nanogpt', undefined, { unavailable: { reason: 'no-subscription', message: 'Add an API key in Settings' } });
        expect(explain(withWords)).toBe('Add an API key in Settings');
        const claudeKey = entry('claude', undefined, { unavailable: { reason: 'no-subscription', message: null } });
        expect(explain(claudeKey)).toBe('API key, no plan limits.');
    });
});

describe('an account without numbers', () => {
    function account(id: string, provider: UsageLimitsProvider | null, state: ProviderAccountStatus['state'] = 'ready'): LimitAccount {
        return { id, kind: 'claude', name: id, color: undefined, entry: provider, status: status(id, 'claude', state) };
    }

    const read = account('one', entry('claude', undefined, { windows: [window('weekly', 900)] }));
    const silent = account('two', entry('claude'));

    test('takes the windows of another account of its CLI, to draw them empty', () => {
        expect(emptyWindows({ kind: 'claude', accounts: [read, silent] }, silent).map((row) => row.id)).toEqual(['weekly']);
    });

    test('has nothing to draw when no account of its CLI has windows', () => {
        expect(emptyWindows({ kind: 'claude', accounts: [silent] }, silent)).toEqual([]);
    });

    test('that cannot be read or is signed out draws none and warns', () => {
        const failed = account('three', entry('claude', undefined, { unavailable: { reason: 'failed', message: null } }));
        const out = account('four', null, 'signed-out');
        const group = { kind: 'claude' as const, accounts: [read, failed, out] };

        expect(emptyWindows(group, failed)).toEqual([]);
        expect(emptyWindows(group, out)).toEqual([]);
        expect(noteIsWarning(failed)).toBe(true);
        expect(noteIsWarning(out)).toBe(true);
    });

    test('on an API key is no problem to solve', () => {
        expect(noteIsWarning(account('five', entry('claude', undefined, { unavailable: { reason: 'no-subscription', message: null } })))).toBe(false);
    });
});

describe('the rings of a folded account', () => {
    test('keep the three windows nearest their limit, in their own order', () => {
        const windows = [0.1, 0.9, 0.5, 0.7].map((used, index) => ({ ...window(`w${index}`, null), used }));

        expect(ringWindows(windows).map((row) => row.id)).toEqual(['w1', 'w2', 'w3']);
    });
});

describe('where the numbers came from', () => {
    test('a read says how long ago, a turn says so first', () => {
        expect(checkedLabel(entry('claude', undefined, { checkedAt: 1_000 }), 1_000 + 30_000)).toBe('now');
        expect(checkedLabel(entry('claude', undefined, { checkedAt: 1_000 }), 1_000 + 120_000)).toBe('2 min ago');
        expect(checkedLabel(entry('claude', undefined, { checkedAt: 1_000, source: 'event' }), 1_000)).toBe('From a turn · now');
    });

    test('an account never read has no time to tell', () => {
        expect(checkedLabel(entry('claude', undefined, { checkedAt: 0 }), 1_000)).toBeNull();
    });
});

describe('the even pace of a window as words', () => {
    const HOUR = 3_600_000;

    const window = (used: number, extra: Partial<UsageWindow> = {}): UsageWindow => ({
        id: 'session',
        kind: 'session',
        label: 'Session',
        used,
        resetsAt: 10 * HOUR,
        durationMs: 5 * HOUR,
        ...extra
    });

    test('reads as words for whoever cannot see the mark', () => {
        expect(paceText(window(0.6), 7 * HOUR)).toBe('60% used, ahead of an even pace of 40%');
        expect(paceText(window(0.2), 7 * HOUR)).toBe('20% used, behind an even pace of 40%');
        expect(paceText(window(0.4), 7 * HOUR)).toBe('40% used, on an even pace');
        expect(paceText(window(0.5, { resetsAt: null }), 7 * HOUR)).toBe('50% used');
    });
});
