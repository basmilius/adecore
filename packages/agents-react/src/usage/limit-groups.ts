import i18next from 'i18next';
import {
    evenPace,
    USAGE_PROVIDERS,
    type ProviderAccounts,
    type ProviderAccountStatus,
    type UsageLimitsProvider,
    type UsageLimitsSnapshot,
    type UsageProvider,
    type UsageWindow
} from '@adecore/agent-contracts';
import { limitsAccountId } from '../agents/account-limits';
import { accountName, accountsOfKind, accountStatusLine } from '../agents/accounts';
import { formatDuration } from '@adecore/ui/format';
import { PROVIDER_LABELS } from './format';

export { evenPace, type EvenPace, type PaceStanding } from '@adecore/agent-contracts';

const MINUTE = 60_000;

/* One account of a CLI as the limits draw it. */
export interface LimitAccount {
    id: string;
    kind: UsageProvider;
    name: string;
    color: string | undefined;
    /* Null for an account the machine does not read, which is one that is not signed in. */
    entry: UsageLimitsProvider | null;
    /* Null for a machine from before accounts, and for an account the machine has not described yet. */
    status: ProviderAccountStatus | null;
}

export interface LimitGroup {
    kind: UsageProvider;
    accounts: LimitAccount[];
}

/*
 * The plan numbers per CLI, one row per account. The machine only reads an account that is signed in,
 * so an account that is on but signed out comes from the account list, where it can say why it has
 * no numbers. An account that is off is left out, also when an older machine still reads it.
 * A CLI the machine reads no plan of, or that is not installed there, has no group, whatever accounts it has.
 */
export function limitGroups(snapshot: UsageLimitsSnapshot, accounts: ProviderAccounts | null): LimitGroup[] {
    return USAGE_PROVIDERS.flatMap((kind) => {
        const entries = snapshot.providers.filter((entry) => entry.kind === kind && entry.unavailable?.reason !== 'not-installed');

        if (entries.length === 0) {
            return [];
        }

        const known = accountsOfKind(accounts, kind);

        const read = entries.flatMap((entry): LimitAccount[] => {
            const id = limitsAccountId(entry);
            const account = known.find((each) => each.id === id);

            if (account?.account.enabled === false) {
                return [];
            }

            return [
                {
                    id,
                    kind,
                    name: account === undefined ? (entry.account?.label ?? PROVIDER_LABELS[kind]) : accountName(account, PROVIDER_LABELS[kind]),
                    color: account === undefined ? entry.account?.color : account.account.color,
                    entry,
                    status: account?.status ?? null
                }
            ];
        });

        const unread = known
            .filter((account) => account.account.enabled !== false && !read.some((row) => row.id === account.id))
            .map((account): LimitAccount => ({
                id: account.id,
                kind,
                name: accountName(account, PROVIDER_LABELS[kind]),
                color: account.account.color,
                entry: null,
                status: account.status
            }));

        // In the person's order, as every other list of accounts; a read account the list does not know yet goes last.
        const place = (id: string): number => {
            const index = known.findIndex((account) => account.id === id);

            return index === -1 ? known.length : index;
        };

        const rows = [...read, ...unread].sort((a, b) => place(a.id) - place(b.id));

        return rows.length === 0 ? [] : [{ kind, accounts: rows }];
    });
}

/* Whether any CLI has more than one account, which is when the limits name the account of every row. */
export function hasSeveralAccounts(groups: readonly LimitGroup[]): boolean {
    return groups.some((group) => group.accounts.length > 1);
}

export function isSignedOut(account: LimitAccount): boolean {
    return account.status?.state === 'signed-out';
}

/* The window that resets first from now, the one reset a line per window has no room to repeat. */
export function nextReset(windows: readonly UsageWindow[], now: number): (UsageWindow & { resetsAt: number }) | null {
    let next: (UsageWindow & { resetsAt: number }) | null = null;

    for (const window of windows) {
        if (window.resetsAt !== null && window.resetsAt > now && (next === null || window.resetsAt < next.resetsAt)) {
            next = { ...window, resetsAt: window.resetsAt };
        }
    }

    return next;
}

/* The bar as words for whoever cannot see the mark: how much is used and how that stands against an even pace. */
export function paceText(window: UsageWindow, now: number): string {
    const percent = Math.round(window.used * 100);
    const pace = evenPace(window, now);

    return pace === null
        ? i18next.t('agent-usage:limits.used', { percent })
        : i18next.t(`agent-usage:limits.pace.${pace.standing}`, { percent, pace: pace.percent });
}

/* When the numbers came in and from where: a read of the machine's own, or a turn that reported them. Null before the first read. */
export function checkedLabel(entry: UsageLimitsProvider, now: number): string | null {
    if (entry.checkedAt <= 0) {
        return null;
    }

    const past = now - entry.checkedAt;
    const when = past < MINUTE ? i18next.t('agent-usage:limits.checked.now') : i18next.t('agent-usage:limits.checked.ago', { duration: formatDuration(past) });

    return entry.source === 'event' ? i18next.t('agent-usage:limits.checked.fromTurn', { when }) : when;
}

/* Why a read account has no bars, or null when it has them. */
export function explain(provider: UsageLimitsProvider): string | null {
    if (provider.unavailable === null) {
        return provider.windows.length === 0 ? i18next.t('agent-usage:limits.none') : null;
    }

    if (provider.unavailable.reason === 'not-installed') {
        return i18next.t('agent-usage:limits.notInstalled');
    }

    if (provider.unavailable.reason === 'no-subscription') {
        // A provider that knows why it has no plan says so; the rest are accounts on an API key.
        return provider.unavailable.message ?? i18next.t('agent-usage:limits.noSubscription');
    }

    return provider.unavailable.message ?? i18next.t('agent-usage:limits.unreachable');
}

/* Why an account has no bars, or null when it has them. An account the machine does not read says what its login is doing. */
export function accountNote(account: LimitAccount): string | null {
    return account.entry === null ? accountStatusLine(account.status, true).text : explain(account.entry);
}
