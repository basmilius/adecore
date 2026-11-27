import { inPickerOrder, type AgentKind, type ModelInfo, type ProviderAccounts, type ProviderAccountState, type ProviderInfo } from '@adecore/agent-contracts';
import { accountName, accountsOfKind, hasAccountChoice, projectOffered, type AccountEntry } from '../agents/accounts';
import { modelRequirementOf } from '../agents/model-requirement';
import type { AccountRule } from '../host/host';
import type { NamedPick } from './mentions';
import type { NamedChipHome } from './ui/named-chip-look';

const MODEL_SUGGESTIONS = 8;
const ACCOUNT_SUGGESTIONS = 3;

export interface ModelSuggestion extends NamedPick {
    kind: 'model';
    cli: AgentKind;
    provider: ProviderInfo;
    model: ModelInfo;

    /* The name of the account in `account`, which the row reads before the model's. */
    accountName?: string;
}

export interface AccountSuggestion extends NamedPick {
    kind: 'account';
    cli: AgentKind;
    provider: ProviderInfo;
    entry: AccountEntry;
    name: string;
}

// A CLI no model runs under while its accounts say this.
const UNUSABLE: ReadonlySet<ProviderAccountState> = new Set(['signed-out', 'not-found', 'folder-missing', 'failed']);

/*
 * Whether the query opens a word of the text: `op` and `opus-5` in "Opus 5.5" or `claude-opus-5-5`, never
 * `pus`. A vendor is no word of a model, so `@open` keeps finding files.
 */
export function startsAWord(text: string, query: string): boolean {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    let index = needle === '' ? -1 : haystack.indexOf(needle);

    while (index >= 0) {
        if (index === 0 || !/[\p{L}\p{N}]/u.test(haystack[index - 1]!)) {
            return true;
        }

        index = haystack.indexOf(needle, index + 1);
    }

    return false;
}

/* Whether a CLI can run a model now: one of its enabled accounts is signed in, or it keeps no accounts at all. */
export function signedIn(accounts: ProviderAccounts | null, kind: AgentKind): boolean {
    const entries = accountsOfKind(accounts, kind);

    if (entries.length === 0) {
        return true;
    }

    return entries.some((entry) => entry.account.enabled !== false && (entry.status === null || !UNUSABLE.has(entry.status.state)));
}

interface ModelAccount {
    id: string;
    name: string;
}

/*
 * The accounts a CLI's models are offered on, the chat's own first: the ready ones the project offers. None
 * while fewer than two are, so a CLI without a choice keeps rows of the model alone.
 */
function modelAccounts(provider: ProviderInfo, accounts: ProviderAccounts | null, rule: AccountRule | null, home: NamedChipHome | null): ModelAccount[] {
    const entries = accountsOfKind(accounts, provider.kind);

    if (!hasAccountChoice(entries)) {
        return [];
    }

    const ready = projectOffered(entries, rule, provider.kind, undefined).filter((entry) => entry.account.enabled !== false && entry.status?.state === 'ready');

    if (ready.length < 2) {
        return [];
    }

    const first = home?.provider === provider.kind ? (home.account ?? provider.kind) : undefined;

    return [...ready.filter((entry) => entry.id === first), ...ready.filter((entry) => entry.id !== first)].map((entry) => ({
        id: entry.id,
        name: accountName(entry, provider.name)
    }));
}

/*
 * The models the `@` list offers for a query: of a CLI that is installed, chats and is signed in, and
 * that the CLI is new enough for. A CLI with a choice of accounts offers a row per account, found by the
 * account's name too, and `<account>/<model>` narrows to both. Legacy models last, at most
 * `MODEL_SUGGESTIONS`. A bare `@` offers none.
 */
export function modelSuggestions(
    providers: readonly ProviderInfo[],
    accounts: ProviderAccounts | null,
    query: string,
    reportedOf: (kind: AgentKind) => ReadonlySet<string>,
    rule: AccountRule | null = null,
    home: NamedChipHome | null = null
): ModelSuggestion[] {
    if (query === '') {
        return [];
    }

    const slash = query.indexOf('/');
    const modelMatches = (model: ModelInfo, words: string): boolean => startsAWord(model.name, words) || startsAWord(model.slug, words);

    // A slash may belong to a model's id (`openrouter/anthropic/claude`), so the whole query still finds a model.
    const accountMatches = (model: ModelInfo, account: ModelAccount): boolean => {
        if (slash < 0) {
            return startsAWord(account.name, query);
        }

        const rest = query.slice(slash + 1);

        return startsAWord(account.name, query.slice(0, slash)) && (rest === '' || modelMatches(model, rest));
    };

    const found = inPickerOrder(providers.filter((entry) => entry.installed && entry.capabilities.chat && signedIn(accounts, entry.kind))).flatMap(
        (provider) => {
            const offered = modelAccounts(provider, accounts, rule, home);

            return provider.models
                .filter((model) => modelRequirementOf(model, provider, reportedOf(provider.kind)) === null)
                .flatMap((model): ModelSuggestion[] => {
                    const row: ModelSuggestion = { kind: 'model', cli: provider.kind, id: model.slug, provider, model };

                    if (offered.length === 0) {
                        return modelMatches(model, query) ? [row] : [];
                    }

                    return offered
                        .filter((account) => modelMatches(model, query) || accountMatches(model, account))
                        .map((account) => ({ ...row, account: account.id, accountName: account.name }));
                });
        }
    );

    return [...found.filter((entry) => !entry.model.legacy), ...found.filter((entry) => entry.model.legacy)].slice(0, MODEL_SUGGESTIONS);
}

/*
 * The accounts the `@` list offers for a query, by the name a person sees: those that are ready, of a CLI
 * with a choice of account, that the project offers. At most `ACCOUNT_SUGGESTIONS`.
 */
export function accountSuggestions(
    providers: readonly ProviderInfo[],
    accounts: ProviderAccounts | null,
    rule: AccountRule | null,
    query: string
): AccountSuggestion[] {
    if (query === '' || accounts === null) {
        return [];
    }

    return inPickerOrder(providers.filter((entry) => entry.installed && entry.capabilities.chat))
        .flatMap((provider) => {
            const entries = accountsOfKind(accounts, provider.kind);

            if (!hasAccountChoice(entries)) {
                return [];
            }

            return projectOffered(entries, rule, provider.kind, undefined)
                .filter((entry) => entry.account.enabled !== false && entry.status?.state === 'ready')
                .map((entry): AccountSuggestion => ({
                    kind: 'account',
                    cli: provider.kind,
                    id: entry.id,
                    provider,
                    entry,
                    name: accountName(entry, provider.name)
                }))
                .filter((suggestion) => startsAWord(suggestion.name, query));
        })
        .slice(0, ACCOUNT_SUGGESTIONS);
}
