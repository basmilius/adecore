import type { UsageLimitsSnapshot, UsageProvider } from '@adecore/agent-contracts';
import { Button, Icon, SectionLabel, Segmented, Tooltip, useNow } from '@adecore/ui';
import { ListRestart, LogIn } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountDot } from '../agents/AccountDot';
import { useChatHost } from '../host/host';
import { useHostLoginBlocked } from '../host/host-hooks';
import { useChatScope } from '../scope';
import { useProviderAccounts } from '../state/provider-accounts';
import { useUsageStore } from '../state/usage';
import { ChartLogo } from './ChartLogo';
import { PROVIDER_LABELS } from './format';
import { accountNote, hasSeveralAccounts, isSignedOut, showsWindows, type LimitAccount } from './limit-groups';
import { LimitProvenance } from './LimitProvenance';
import { useLimitGroups, useUsageLimits } from './limits';
import { WindowBar } from './LimitsList';

const MINUTE_MS = 60_000;

type Filter = UsageProvider | 'all';

interface Login {
    /* Why a login cannot open a terminal right now, or null when it can. */
    blocked: string | null;
    open: (account: LimitAccount) => void;
}

function LoginButton({ account, login }: { account: LimitAccount; login: Login }) {
    const { t } = useTranslation('agent-usage');

    const button = (
        <Button
            variant="secondary"
            size="sm"
            className={login.blocked === null ? 'self-start' : undefined}
            disabled={login.blocked !== null}
            onClick={() => login.open(account)}
        >
            <Icon icon={LogIn} size={14} />
            {t('limits.logIn')}
        </Button>
    );

    return login.blocked === null ? (
        button
    ) : (
        <Tooltip label={login.blocked}>
            <span className="inline-flex self-start">{button}</span>
        </Tooltip>
    );
}

/* One account: where its numbers come from, then a bar per window, or why there are none. */
function LimitCard({ account, named, now, login }: { account: LimitAccount; named: boolean; now: number; login: Login | null }) {
    const { t } = useTranslation('agent-usage');
    const signedOut = isSignedOut(account);
    const note = signedOut ? null : accountNote(account);
    const plan = signedOut ? null : account.entry?.plan;

    return (
        <div className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-border bg-surface bg-clip-padding px-4 py-3.5">
            <p className="flex min-w-0 items-center gap-2 text-xs font-medium">
                <ChartLogo provider={account.kind} className="shrink-0" />
                <span className="shrink-0">{PROVIDER_LABELS[account.kind]}</span>
                {named && (
                    <>
                        <span className="text-text-faint">·</span>
                        <AccountDot color={account.color} />
                        <span className="truncate">{account.name}</span>
                    </>
                )}
                {plan && <span className="shrink-0 font-normal text-text-muted capitalize">· {plan}</span>}
            </p>
            {!signedOut && account.entry !== null && <LimitProvenance entry={account.entry} now={now} />}
            {signedOut ? (
                <>
                    <p className="text-xs text-text-faint">{t('limits.signedOutDetail')}</p>
                    {login !== null && <LoginButton account={account} login={login} />}
                </>
            ) : (
                <>
                    {note !== null && <p className="text-xs text-text-muted">{note}</p>}
                    {showsWindows(account.entry) && (
                        <div className="flex flex-col gap-4">
                            {account.entry?.windows.map((window) => (
                                <WindowBar key={window.id} window={window} now={now} compact={false} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/*
 * What is left of each plan, asked of the CLIs themselves, a card per account. Nothing here reads a
 * credential: every CLI holds its own login and answers the question when the daemon starts one and asks.
 */
export function UsageLimits() {
    const host = useChatHost();
    const { t } = useTranslation('agent-usage');
    const limits = useUsageLimits();
    const groups = useLimitGroups(limits);
    const now = useNow(MINUTE_MS);
    const scopeId = useChatScope().id;
    const loginCommands = useProviderAccounts((row) => row.accounts?.loginCommands);
    const { openLogin } = host;
    const blocked = useHostLoginBlocked(scopeId);
    const [filter, setFilter] = useState<Filter>('all');

    const filterable = groups.length > 1 && hasSeveralAccounts(groups);
    const current = filterable && groups.some((group) => group.kind === filter) ? filter : 'all';
    const shown = current === 'all' ? groups : groups.filter((group) => group.kind === current);

    const loginFor = (kind: UsageProvider): Login | null =>
        openLogin === null || loginCommands?.[kind] === undefined
            ? null
            : { blocked, open: (account) => void openLogin(scopeId, kind, account.id, account.name) };

    return (
        <section className="flex flex-col gap-3">
            <div className="flex min-h-8 items-center gap-3">
                <SectionLabel render={<h2 />} className="grow">
                    {t('limits.title')}
                </SectionLabel>
                <LimitsRefresh key={scopeId} limits={limits} />
                {filterable && (
                    <Segmented<Filter>
                        value={current}
                        options={[
                            { id: 'all', label: t('dialog.accounts.all') },
                            ...groups.map((group) => ({ id: group.kind, label: PROVIDER_LABELS[group.kind] }))
                        ]}
                        onValueChange={setFilter}
                        label={t('limits.filter')}
                    />
                )}
            </div>
            <p className="text-xs text-text-muted">{t('limits.explain')}</p>
            {limits === null && <p className="text-xs text-text-faint">{t('limits.notRead')}</p>}
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                {shown.flatMap((group) =>
                    group.accounts.map((account) => (
                        <LimitCard key={account.id} account={account} named={group.accounts.length > 1} now={now} login={loginFor(group.kind)} />
                    ))
                )}
            </div>
        </section>
    );
}

function LimitsRefresh({ limits }: { limits: UsageLimitsSnapshot | null }) {
    const { t } = useTranslation('agent-usage');
    const scope = useChatScope();
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<{ snapshot: UsageLimitsSnapshot | null } | null>(null);
    const pending = useRef(false);
    const alive = useRef(true);
    const answering = useSyncExternalStore(
        (changed) => scope.transport.subscribeStatus(changed),
        () => scope.transport.status === 'open',
        () => false
    );

    useEffect(() => {
        alive.current = true;

        return () => {
            alive.current = false;
        };
    }, []);

    const read = async () => {
        if (pending.current || scope.transport.status !== 'open') {
            return;
        }

        pending.current = true;
        setBusy(true);
        setFailure(null);

        try {
            const snapshot = await scope.transport.request('usage.refreshLimits', {});

            if (alive.current) {
                useUsageStore.getState().setLimits(scope.id, snapshot);
            }
        } catch {
            if (alive.current) {
                setFailure({ snapshot: useUsageStore.getState().byScope[scope.id]?.limits ?? null });
            }
        } finally {
            pending.current = false;

            if (alive.current) {
                setBusy(false);
            }
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <Tooltip label={answering ? t('limits.refreshHint') : t('limits.offline')}>
                <span>
                    <Button size="sm" variant="secondary" disabled={!answering || busy} onClick={() => void read()}>
                        <Icon icon={ListRestart} size={14} />
                        {busy ? t('limits.reading') : t('limits.refresh')}
                    </Button>
                </span>
            </Tooltip>
            {failure !== null && failure.snapshot === limits && (
                <p role="alert" className="max-w-80 text-xs text-status-error">
                    {t('limits.refreshFailed')}
                </p>
            )}
        </div>
    );
}
