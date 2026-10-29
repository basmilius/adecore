import type { AgentKind, ProviderAccounts } from '@adecore/agent-contracts';
import {
    accountName,
    accountsOfKind,
    hasAccountChoice,
    offeredAccounts,
    projectDefault,
    projectOffered,
    type AccountEntry,
    type AccountRule
} from '../agents/accounts';
import { useHostAccountRule } from '../host-hooks';
import { useChatScope } from '../scope';
import { useProviderAccounts, type ProviderAccountsRow } from '../state/provider-accounts';
import { useProviders } from '../state/providers';

export interface AccountChoice {
    accounts: ProviderAccounts;
    /* The accounts a person may pick for this CLI: those that are on and the chat's project offers, and the one in use. */
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
export function useAccountChoice(kind: AgentKind | null, account: string | undefined, chatId: string): AccountChoice | null {
    const scope = useChatScope();
    const rule = useHostAccountRule(scope.id, chatId);
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
        offered: projectOffered(offeredAccounts(entries, currentId), rule, kind, currentId),
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
    | {
          status: 'ready';
          offered: AccountEntry[];
          /* The account the project starts new chats of this CLI on, by id; null leaves it to the order. */
          projectDefault: string | null;
          providerName: string;
          nameOf(entry: AccountEntry): string;
      };

// One object each, so a render that changes nothing hands back the same answer.
const LOADING: NewAccountChoice = { status: 'loading' };
const UNSUPPORTED: NewAccountChoice = { status: 'unsupported' };

/* `useNewAccountChoice` without React, for its tests. */
export function newAccountChoiceOf(row: ProviderAccountsRow, kind: AgentKind | null, providerName: string, rule: AccountRule | null = null): NewAccountChoice {
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
        offered: projectOffered(offeredAccounts(entries, undefined), rule, kind, undefined),
        projectDefault: projectDefault(entries, rule, kind),
        providerName,
        nameOf: (entry: AccountEntry) => accountName(entry, providerName)
    };
}

/* The accounts a new chat or agent of this CLI may start under on the machine in scope, within what the project of that start says. */
export function useNewAccountChoice(kind: AgentKind | null, rule: AccountRule | null = null): NewAccountChoice {
    const row = useProviderAccounts((entry) => entry);
    const providerName = useProviders((entry) => entry.providers.find((provider) => provider.kind === kind)?.name) ?? kind ?? '';

    return newAccountChoiceOf(row, kind, providerName, rule);
}
