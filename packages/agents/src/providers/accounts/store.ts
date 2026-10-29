import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
    orderedAccountIds,
    ProviderAccountIdSchema,
    ProviderAccountSchema,
    type AgentKind,
    type ProviderAccount,
    type ProviderAccountMap
} from '@adecore/agent-contracts';
import { CodedError } from '../../coded-error.ts';
import { isNotFound, writeAtomic } from '../../fs.ts';
import type { ChatProvider } from '../provider.ts';
import {
    accountFolder,
    accountProblem,
    defaultFolder,
    expandHome,
    folderVariablesOf,
    isDefaultAccount,
    isOfferedKind,
    readAccount,
    withDefaults,
    type AccountProviders,
    type Env
} from './accounts.ts';
import { DEFAULT_ACCOUNTS_HOST, redactVariables, type AccountsHost } from './variables.ts';

const FILE_VERSION = 1;

export function accountsPath(home: string): string {
    return join(home, 'providers.json');
}

/*
 * The accounts as the file holds them. A known kind is a parsed account; an unknown one is the entry
 * exactly as it was read, so a newer version's fields survive this one writing the file.
 */
export type StoredAccounts = Record<string, unknown>;

/* Every entry that does not parse is dropped on its own; a file that is not JSON at all reads as none. */
export async function readAccounts(path: string, providers: AccountProviders, env: Env, host: AccountsHost = DEFAULT_ACCOUNTS_HOST): Promise<StoredAccounts> {
    let parsed: unknown;

    try {
        parsed = JSON.parse(await readFile(path, 'utf8'));
    } catch (e) {
        if (isNotFound(e) || e instanceof SyntaxError) {
            return {};
        }

        throw e;
    }

    const entries = typeof parsed === 'object' && parsed !== null ? (parsed as { accounts?: unknown }).accounts : null;

    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) {
        return {};
    }

    const stored: StoredAccounts = {};

    for (const [id, raw] of Object.entries(entries)) {
        if (!ProviderAccountIdSchema.safeParse(id).success) {
            continue;
        }

        const account = readAccount(id, raw, providers, env, host);

        if (account !== null) {
            stored[id] = account;
        }
    }

    return stored;
}

export async function writeAccounts(path: string, stored: StoredAccounts): Promise<void> {
    await writeAtomic(path, `${JSON.stringify({ version: FILE_VERSION, accounts: stored }, null, 2)}\n`, 0o600);
}

/* What a client reads of an entry of a kind it may not know either: the fields this version knows. */
function wireAccount(entry: unknown): ProviderAccount {
    const parsed = ProviderAccountSchema.safeParse(entry);

    if (!parsed.success) {
        return { kind: String((entry as { kind?: unknown }).kind) };
    }

    return parsed.data.env === undefined ? parsed.data : { ...parsed.data, env: redactVariables(parsed.data.env) };
}

export function wireAccounts(stored: StoredAccounts, kinds: readonly AgentKind[]): ProviderAccountMap {
    return withDefaults(Object.fromEntries(Object.entries(stored).map(([id, entry]) => [id, wireAccount(entry)])), kinds);
}

export class InvalidAccountError extends CodedError<'invalid-account'> {
    constructor(message: string) {
        super('invalid-account', message);
    }
}

function storedFolders(entry: unknown): Pick<ProviderAccount, 'home' | 'shadowHome'> {
    const parsed = ProviderAccountSchema.safeParse(entry);

    return parsed.success ? { home: parsed.data.home, shadowHome: parsed.data.shadowHome } : {};
}

/*
 * What is wrong with the folders of an account a person points somewhere new, or null. An account
 * whose folders did not change is left alone, so one whose folder went missing can still be renamed.
 */
function linkProblem(
    id: string,
    account: ProviderAccount,
    before: unknown,
    provider: ChatProvider,
    env: Env,
    isDirectory: (path: string) => boolean
): string | null {
    if (isDefaultAccount(id, account) || provider.home === undefined || account.home === undefined) {
        return null;
    }

    const was = storedFolders(before);

    if (was.home === account.home && was.shadowHome === account.shadowHome) {
        return null;
    }

    for (const folder of [account.home, account.shadowHome]) {
        if (folder !== undefined && !isDirectory(expandHome(folder, env))) {
            return `${folder} is not a folder on this machine`;
        }
    }

    if (accountFolder(id, account, provider, env) === defaultFolder(provider, env)) {
        return `${defaultFolder(provider, env)} is the folder of the default ${provider.name} account`;
    }

    return null;
}

/*
 * The whole map a person saved, as the file will hold it. A mistake in an account of a known kind
 * refuses the save; an account of an unknown kind keeps the entry the file had under its id, which a
 * client that knows the kind no better than this host could only have cut short. Sensitive values
 * are still in it: the caller puts them in the keychain before the file is written.
 */
export function acceptAccounts(
    saved: ProviderAccountMap,
    before: StoredAccounts,
    providers: AccountProviders,
    env: Env,
    isDirectory: (path: string) => boolean,
    host: AccountsHost = DEFAULT_ACCOUNTS_HOST
): StoredAccounts {
    const stored: StoredAccounts = {};
    const reserved = { host, folderVariables: folderVariablesOf(providers) };

    for (const [id, account] of Object.entries(withDefaults(saved, providers.kinds))) {
        if (!isOfferedKind(account.kind, providers.kinds)) {
            if (isOfferedKind(id, providers.kinds)) {
                throw new InvalidAccountError(`"${id}" is the id of the default ${id} account`);
            }

            const kept = before[id];
            const keptKind = typeof kept === 'object' && kept !== null ? (kept as { kind?: unknown }).kind : undefined;
            stored[id] = keptKind === account.kind ? kept : account;

            continue;
        }

        const provider = providers.get(account.kind);

        const problem =
            accountProblem(id, account, provider, env, reserved, providers.kinds) ?? linkProblem(id, account, before[id], provider, env, isDirectory);

        if (problem !== null) {
            throw new InvalidAccountError(`${id}: ${problem}`);
        }

        stored[id] = withKeptOrder(account, before[id]);
    }

    return stored;
}

/* An older client strips `order` from what it saves, so an account saved without one keeps the place it had. */
function withKeptOrder(account: ProviderAccount, before: unknown): ProviderAccount {
    if (account.order !== undefined || typeof before !== 'object' || before === null) {
        return account;
    }

    const order = (before as { order?: unknown }).order;

    return typeof order === 'number' ? { ...account, order } : account;
}

/* The map with the accounts of one CLI in this order; one of that CLI not named, such as one made meanwhile, follows in the order it had. */
export function reorderedAccounts(accounts: ProviderAccountMap, kind: AgentKind, ids: readonly string[]): ProviderAccountMap {
    if (new Set(ids).size !== ids.length) {
        throw new InvalidAccountError('an account is named twice in the order');
    }

    for (const id of ids) {
        const account = accounts[id];

        if (account === undefined) {
            throw new InvalidAccountError(`${id}: no account on this machine has that id`);
        }

        if (account.kind !== kind) {
            throw new InvalidAccountError(`${id}: it is an account of ${account.kind}, not of ${kind}`);
        }
    }

    const order = [...ids, ...orderedAccountIds(accounts, kind).filter((id) => !ids.includes(id))];
    const reordered: ProviderAccountMap = { ...accounts };

    for (const [place, id] of order.entries()) {
        reordered[id] = { ...accounts[id], order: place } as ProviderAccount;
    }

    return reordered;
}
