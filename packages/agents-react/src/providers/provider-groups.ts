import i18next from 'i18next';
import type { ProviderAccounts, ProviderAccountStatus, ProviderInfo } from '@adecore/agent-contracts';
import { accountsOfKind, type AccountEntry } from '../agents/accounts';

/* A few words beside a provider in the list; `warning` asks the person to act. */
export interface ProviderSetupStatus {
    text: string;
    tone: 'muted' | 'warning';
}

export interface ProviderRow {
    provider: ProviderInfo;
    entries: AccountEntry[];
    /* What the row says on its right: the plan of its one account, or what is still missing. */
    note: ProviderSetupStatus | null;
}

export interface ProviderGroups {
    ready: ProviderRow[];
    setup: ProviderRow[];
    missing: ProviderInfo[];
}

/* What an account says beside its name: its plan while it is ready, a short word when it is not, nothing while it is checked. */
export function accountNote(status: ProviderAccountStatus | null): ProviderSetupStatus | null {
    const words = (key: string): string => i18next.t(`agent-providers:${key}`);

    switch (status?.state ?? 'checking') {
        case 'checking':
            return null;
        case 'ready':
            return status?.plan ? { text: status.plan, tone: 'muted' } : null;
        case 'signed-out':
            return { text: words('list.signedOut'), tone: 'warning' };
        case 'failed':
            return { text: words('status.failed'), tone: 'warning' };
        case 'folder-missing':
            return { text: words('status.folderMissing'), tone: 'warning' };
        case 'disabled':
            return { text: words('status.disabled'), tone: 'muted' };
        case 'not-found':
            return { text: words('status.notFound'), tone: 'muted' };
        case 'unavailable':
            return { text: words('status.unavailable'), tone: 'muted' };
    }
}

// An account still being checked counts as usable, so a provider does not hop between groups while the checks run.
const usable = (entry: AccountEntry): boolean => entry.status === null || entry.status.state === 'ready' || entry.status.state === 'checking';

/*
 * The providers in the three groups of the list. A provider the host says is not set up needs setup whatever
 * its accounts say; otherwise one usable account, or none to read, makes it ready.
 */
export function groupProviders(
    providers: readonly ProviderInfo[],
    accounts: ProviderAccounts | null,
    setupStatusOf?: (provider: ProviderInfo) => ProviderSetupStatus | null
): ProviderGroups {
    const groups: ProviderGroups = { ready: [], setup: [], missing: [] };

    for (const provider of providers) {
        // A provider that never runs in a terminal is no CLI to install: it is turned on in its own detail.
        if (!provider.installed && provider.capabilities.terminal) {
            groups.missing.push(provider);

            continue;
        }

        const entries = provider.installed ? accountsOfKind(accounts, provider.kind) : [];
        const hostStatus = setupStatusOf?.(provider) ?? null;

        if (hostStatus !== null) {
            groups.setup.push({ provider, entries, note: hostStatus });
        } else if (entries.length === 0 || entries.some(usable)) {
            groups.ready.push({ provider, entries, note: entries.length === 1 ? accountNote(entries[0]!.status) : null });
        } else {
            groups.setup.push({ provider, entries, note: accountNote(entries[0]!.status) });
        }
    }

    return groups;
}
