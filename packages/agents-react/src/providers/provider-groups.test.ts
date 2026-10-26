import { describe, expect, test } from 'bun:test';
import type { ProviderAccounts, ProviderAccountStatus, ProviderInfo } from '@adecore/agent-contracts';
import { accountNote, groupProviders } from './provider-groups';

function providerOf(kind: string, patch: Partial<ProviderInfo> = {}): ProviderInfo {
    return { kind, name: kind, installed: true, version: '1.0.0', models: [], capabilities: { terminal: true }, ...patch } as unknown as ProviderInfo;
}

function statusOf(id: string, kind: string, state: ProviderAccountStatus['state'], plan: string | null = null): ProviderAccountStatus {
    return { id, kind, state, email: null, plan, organization: null, home: `/home/${id}`, message: null, checkedAt: 1 } as ProviderAccountStatus;
}

function accountsOf(...statuses: ProviderAccountStatus[]): ProviderAccounts {
    return {
        accounts: Object.fromEntries(statuses.map((status) => [status.id, { kind: status.kind }])),
        statuses,
        secretsAvailable: true
    } as ProviderAccounts;
}

const kindsOf = (rows: ReadonlyArray<{ provider: ProviderInfo }>): string[] => rows.map((row) => row.provider.kind);

describe('groupProviders', () => {
    test('a CLI with a ready account is ready and shows the plan of its one account', () => {
        const groups = groupProviders([providerOf('acme')], accountsOf(statusOf('acme', 'acme', 'ready', 'max')));
        expect(kindsOf(groups.ready)).toEqual(['acme']);
        expect(groups.ready[0]!.note).toEqual({ text: 'max', tone: 'muted' });
    });

    test('a CLI with several accounts shows no plan on its own row', () => {
        const groups = groupProviders(
            [providerOf('acme')],
            accountsOf(statusOf('acme', 'acme', 'ready', 'max'), statusOf('acme_work', 'acme', 'ready', 'pro'))
        );

        expect(groups.ready[0]!.entries).toHaveLength(2);
        expect(groups.ready[0]!.note).toBeNull();
    });

    test('one usable account is enough, and an account still being checked counts as usable', () => {
        const groups = groupProviders(
            [providerOf('acme'), providerOf('beta')],
            accountsOf(statusOf('acme', 'acme', 'signed-out'), statusOf('acme_work', 'acme', 'ready'), statusOf('beta', 'beta', 'checking'))
        );

        expect(kindsOf(groups.ready)).toEqual(['acme', 'beta']);
        expect(groups.setup).toEqual([]);
    });

    test('a provider without accounts to read is ready', () => {
        const groups = groupProviders([providerOf('acme'), providerOf('local', { capabilities: { terminal: false } as ProviderInfo['capabilities'] })], null);
        expect(kindsOf(groups.ready)).toEqual(['acme', 'local']);
        expect(groups.ready.every((row) => row.note === null)).toBe(true);
    });

    test('a CLI whose accounts are all signed out or failing needs setup, with a short word on why', () => {
        const groups = groupProviders(
            [providerOf('acme'), providerOf('beta')],
            accountsOf(statusOf('acme', 'acme', 'signed-out'), statusOf('beta', 'beta', 'failed'))
        );

        expect(groups.ready).toEqual([]);

        expect(groups.setup.map((row) => row.note)).toEqual([
            { text: 'Not logged in', tone: 'warning' },
            { text: 'Check failed', tone: 'warning' }
        ]);
    });

    test('what the host says comes before what the accounts say', () => {
        const local = providerOf('local', { installed: false, capabilities: { terminal: false } as ProviderInfo['capabilities'] });

        const groups = groupProviders([providerOf('acme'), local], accountsOf(statusOf('acme', 'acme', 'ready', 'max')), (provider) =>
            provider.kind === 'local' ? { text: 'Off', tone: 'muted' } : null
        );

        expect(kindsOf(groups.ready)).toEqual(['acme']);
        expect(kindsOf(groups.setup)).toEqual(['local']);
        expect(groups.setup[0]!.note).toEqual({ text: 'Off', tone: 'muted' });
    });

    test('a CLI that is not installed is listed apart, without its accounts', () => {
        const groups = groupProviders([providerOf('acme', { installed: false })], accountsOf(statusOf('acme', 'acme', 'signed-out')));
        expect(groups.missing.map((provider) => provider.kind)).toEqual(['acme']);
        expect(groups.ready).toEqual([]);
        expect(groups.setup).toEqual([]);
    });
});

describe('accountNote', () => {
    test('a ready account says its plan, or nothing without one', () => {
        expect(accountNote(statusOf('acme', 'acme', 'ready', 'pro'))).toEqual({ text: 'pro', tone: 'muted' });
        expect(accountNote(statusOf('acme', 'acme', 'ready'))).toBeNull();
    });

    test('an account being checked says nothing yet', () => {
        expect(accountNote(null)).toBeNull();
        expect(accountNote(statusOf('acme', 'acme', 'checking'))).toBeNull();
    });

    test('a turned off account is muted', () => {
        expect(accountNote(statusOf('acme', 'acme', 'disabled'))).toEqual({ text: 'Off', tone: 'muted' });
    });
});
