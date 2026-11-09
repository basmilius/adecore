import { UsageProviderSchema, type AgentKind, type ProviderAccounts, type ProviderInfo } from '@adecore/agent-contracts';
import { useContext } from 'react';
import { accountColor, accountName, accountsOfKind, topAccountEntry } from '../../agents/accounts';
import { useChatHost, type AccentChoice } from '../../host/host';
import { ChatScopeContext } from '../../scope';
import { useProviderAccountsStore } from '../../state/provider-accounts';
import { useProvidersStore } from '../../state/providers';
import { PROVIDER_COLORS } from '../../usage/format';
import type { NamedChipKind } from '../mentions';

/* How a named chip reads: the name the machine knows it by, else its id, and the color of the account it runs on. */
export interface NamedChipLook {
    label: string;
    color: string | undefined;
}

export type NamedChipLookup = (kind: NamedChipKind, cli: string, id: string) => NamedChipLook;

/* The chat a chip is written in: a model chip of its CLI starts under its account, as an agent it opens inherits it. */
export interface NamedChipHome {
    provider: AgentKind;
    account: string | undefined;
}

const NO_PROVIDERS: ProviderInfo[] = [];

export function namedChipLookup(
    providers: readonly ProviderInfo[],
    accounts: ProviderAccounts | null,
    accents: readonly AccentChoice[],
    home: NamedChipHome | null
): NamedChipLookup {
    const colorOf = (cli: string, accountId: string | undefined): string | undefined => {
        const entries = accountsOfKind(accounts, cli as AgentKind);
        const entry = accountId === undefined ? topAccountEntry(entries) : entries.find((candidate) => candidate.id === accountId);
        const kind = UsageProviderSchema.safeParse(cli);

        return accountColor(entry?.account.color, accents) ?? (kind.success ? PROVIDER_COLORS[kind.data] : undefined);
    };

    return (kind, cli, id) => {
        const provider = providers.find((entry) => entry.kind === cli);

        if (kind === 'model') {
            const account = home?.provider === cli ? (home.account ?? cli) : undefined;

            return { label: provider?.models.find((model) => model.slug === id)?.name ?? id, color: colorOf(cli, account) };
        }

        const entry = accountsOfKind(accounts, cli as AgentKind).find((candidate) => candidate.id === id);

        return { label: entry === undefined ? id : accountName(entry, provider?.name ?? cli), color: colorOf(cli, id) };
    };
}

/* `namedChipLookup` for the machine in scope; outside a scope, every chip keeps its id. */
export function useNamedChipLookup(home: NamedChipHome | null = null): NamedChipLookup {
    const scope = useContext(ChatScopeContext);
    const { accents } = useChatHost();
    const providers = useProvidersStore((s) => (scope === null ? NO_PROVIDERS : (s.byScope[scope.id]?.providers ?? NO_PROVIDERS)));
    const accounts = useProviderAccountsStore((s) => (scope === null ? null : (s.byScope[scope.id]?.accounts ?? null)));

    return namedChipLookup(providers, accounts, accents.all, home);
}
