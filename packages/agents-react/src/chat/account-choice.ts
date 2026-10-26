import type { AgentKind, ProviderAccounts } from '@adecore/agent-contracts';
import { accountName, accountsOfKind, hasAccountChoice, offeredAccounts, type AccountEntry } from '../agents/accounts';
import { useProviderAccounts, type ProviderAccountsRow } from '../state/provider-accounts';
import { useProviders } from '../state/providers';

export interface AccountChoice {
    accounts: ProviderAccounts;
    /* The accounts a person may pick for this CLI: those that are on, and the one in use. */
    offered: AccountEntry[];
    /* The account the chat runs under, by id; the CLI's kind for its default account. */
    currentId: string;
    /* Null for an account the machine no longer has. */
    current: AccountEntry | null;
    providerName: string;
    nameOf(entry: AccountEntry): string;
}

/*
 * The accounts of a chat's CLI on the machine in scope and the one the chat runs under, or null while
 * the CLI has fewer than two accounts that are on: with one there is nothing to choose or tell apart.
 */
export function useAccountChoice(kind: AgentKind | null, account: string | undefined): AccountChoice | null {
    const accounts = useProviderAccounts((row) => row.accounts);
    const providerName = useProviders((row) => row.providers.find((entry) => entry.kind === kind)?.name) ?? kind ?? '';

    if (kind === null || accounts === null) {
        return null;
    }

    const entries = accountsOfKind(accounts, kind);

    if (!hasAccountChoice(entries)) {
        return null;
    }

    const currentId = account ?? kind;

    return {
        accounts,
        offered: offeredAccounts(entries, currentId),
        currentId,
        current: entries.find((entry) => entry.id === currentId) ?? null,
        providerName,
        nameOf: (entry: AccountEntry) => accountName(entry, providerName)
    };
}

/*
 * The accounts a new chat or agent of a CLI may start under. `loading` until the machine answered, and
 * while no CLI is picked yet; `unsupported` for a machine that keeps no accounts for the CLI, which
 * then starts under its own login. `offered` holds only the accounts that are on, also when that is
 * one or none: nothing runs under a new chat yet, so a turned-off account has no reason to stay.
 */
export type NewAccountChoice =
    | { status: 'loading' }
    | { status: 'unsupported' }
    | { status: 'ready'; offered: AccountEntry[]; providerName: string; nameOf(entry: AccountEntry): string };

// One object each, so a render that changes nothing hands back the same answer.
const LOADING: NewAccountChoice = { status: 'loading' };
const UNSUPPORTED: NewAccountChoice = { status: 'unsupported' };

/* `useNewAccountChoice` without React, for its tests. */
export function newAccountChoiceOf(row: ProviderAccountsRow, kind: AgentKind | null, providerName: string): NewAccountChoice {
    if (kind === null || !row.loaded) {
        return LOADING;
    }

    const entries = accountsOfKind(row.accounts, kind);

    // An older machine lists no accounts at all, or none of a CLI it does not know.
    if (entries.length === 0) {
        return UNSUPPORTED;
    }

    return {
        status: 'ready',
        offered: offeredAccounts(entries, undefined),
        providerName,
        nameOf: (entry: AccountEntry) => accountName(entry, providerName)
    };
}

/* The accounts a new chat or agent of this CLI may start under on the machine in scope. */
export function useNewAccountChoice(kind: AgentKind | null): NewAccountChoice {
    const row = useProviderAccounts((entry) => entry);
    const providerName = useProviders((entry) => entry.providers.find((provider) => provider.kind === kind)?.name) ?? kind ?? '';

    return newAccountChoiceOf(row, kind, providerName);
}
