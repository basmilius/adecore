import { Fragment } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UsageLimitsSnapshot, UsageWindow } from '@adecore/agent-contracts';
import { limitsAccountId } from '../agents/account-limits';
import { AccountDot } from '../agents/AccountDot';
import { Tooltip } from '@adecore/ui';
import { formatClock, formatWeekdayClock, isSameDay, formatCountdown, formatPercent } from '@adecore/ui/format';
import { ChartLogo } from './ChartLogo';
import { PROVIDER_LABELS } from './format';
import { accountNote, evenPace, explain, isSignedOut, nextReset, paceText, type LimitAccount, type LimitGroup, type PaceStanding } from './limit-groups';

/* Red where a window is nearly spent, amber where it is worth knowing; room to spare is not news and takes the text color. */
function toneOf(used: number): string {
    return used >= 0.9 ? 'bg-status-error' : used >= 0.7 ? 'bg-status-needs-you' : 'bg-text';
}

/* A time of day when the reset is today, a weekday and a time when it is not. */
function resetAtLabel(resetsAt: number, now: number): string {
    return isSameDay(resetsAt, now) ? formatClock(resetsAt) : formatWeekdayClock(resetsAt);
}

/* How long the window still has, or nothing once it has run out. */
function resetInLabel(resetsAt: number, now: number): string | null {
    return resetsAt <= now ? null : formatCountdown(resetsAt - now);
}

const PACE_LINES: Record<PaceStanding, string> = {
    ahead: 'limits.faster',
    behind: 'limits.slower',
    even: 'limits.even'
};

export function WindowBar({ window, now, compact }: { window: UsageWindow; now: number; compact: boolean }) {
    const { t } = useTranslation('agent-usage');
    const percent = Math.round(window.used * 100);
    // The bar fills as the quota is spent, so the mark beside it is how much of the window has run.
    const pace = evenPace(window, now);
    const mark = pace?.percent ?? null;
    const resetsAt = window.resetsAt === null ? null : resetAtLabel(window.resetsAt, now);
    const resetsIn = window.resetsAt === null ? null : resetInLabel(window.resetsAt, now);

    const bar = (
        <div
            role="progressbar"
            aria-label={t('limits.bar', { window: window.label, percent })}
            aria-valuenow={percent}
            aria-valuetext={paceText(window, now)}
            aria-valuemin={0}
            aria-valuemax={100}
            className={clsx('relative cursor-default', compact ? 'h-4' : 'h-6')}
        >
            <div className={clsx('absolute inset-x-0 rounded-full bg-surface-sunken', compact ? 'inset-y-1' : 'inset-y-1.5')} />
            {/* Past a hundred there is nothing left to fill, so the bar stops rather than overflows. */}
            <div
                className={clsx('absolute left-0 rounded-full', compact ? 'inset-y-1' : 'inset-y-1.5', toneOf(window.used))}
                style={{ width: `${Math.min(100, percent)}%` }}
            />
            {/* Past the mark is spending faster than the window gives back, short of it slower. */}
            {mark !== null && (
                // Inside the fill the line has to be cut out of it, outside it drawn on the track.
                <span
                    aria-hidden
                    className={clsx('absolute inset-y-0.5 w-px -translate-x-1/2', mark <= percent ? 'bg-surface' : 'bg-text-muted')}
                    style={{ left: `${mark}%` }}
                />
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 text-xs">
                <span className="text-text">{window.label}</span>
                <span className="ml-auto tabular-nums text-text-muted">{t('limits.used', { percent })}</span>
            </div>
            {compact ? (
                bar
            ) : (
                <Tooltip
                    label={
                        <span className="flex flex-col gap-0.5">
                            <span>
                                {t('limits.used', { percent })}
                                {mark !== null && ` · ${t('limits.windowPassed', { percent: mark })}`}
                            </span>
                            {pace !== null && <span className="text-text-muted">{t(PACE_LINES[pace.standing])}</span>}
                        </span>
                    }
                >
                    {bar}
                </Tooltip>
            )}
            {/* Under the bar: a weekday and a countdown are too long to share the label's line. */}
            {resetsAt !== null && (
                <p className="text-xs whitespace-nowrap text-text-faint">
                    {t('limits.resets', { at: resetsAt })}
                    {resetsIn !== null && ` · ${resetsIn}`}
                </p>
            )}
        </div>
    );
}

interface LimitsListProps {
    limits: UsageLimitsSnapshot;
    now: number;
    /* Shorter bars, and no tooltip of their own, what a list that is itself a hover card needs. */
    compact?: boolean;
}

/* Every provider with what its plan has left, shared by the usage page and the sidebar card. */
export function LimitsList({ limits, now, compact = false }: LimitsListProps) {
    return (
        <div className={clsx('flex flex-col', compact ? 'gap-4' : 'gap-6')}>
            {limits.providers.map((provider) => {
                const note = explain(provider);

                return (
                    <div key={limitsAccountId(provider)} className="flex flex-col gap-2">
                        <p className="flex items-center gap-2 text-xs font-medium">
                            <ChartLogo provider={provider.kind} />
                            {PROVIDER_LABELS[provider.kind]}
                            {provider.plan !== null && <span className="text-text-muted">· {provider.plan}</span>}
                        </p>
                        {note === null ? (
                            <div className={clsx('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
                                {provider.windows.map((window) => (
                                    <WindowBar key={window.id} window={window} now={now} compact={compact} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-text-faint">{note}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* One window on one line, for a card that holds several accounts: the label, a thin bar with the elapsed mark, the percent. */
function WindowLine({ window, now }: { window: UsageWindow; now: number }) {
    const { t } = useTranslation('agent-usage');
    const percent = Math.round(window.used * 100);
    const mark = evenPace(window, now)?.percent ?? null;

    return (
        <>
            <span className="text-text-muted">{window.label}</span>
            <div
                role="progressbar"
                aria-label={t('limits.bar', { window: window.label, percent })}
                aria-valuenow={percent}
                aria-valuetext={paceText(window, now)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-1.5 rounded-full bg-surface-sunken"
            >
                <div className={clsx('absolute inset-y-0 left-0 rounded-full', toneOf(window.used))} style={{ width: `${Math.min(100, percent)}%` }} />
                {mark !== null && (
                    // Cut out of the fill in the popup's own color, drawn on the track past it.
                    <span
                        aria-hidden
                        className={clsx('absolute -inset-y-0.5 w-px -translate-x-1/2', mark <= percent ? 'bg-surface-raised' : 'bg-text-muted')}
                        style={{ left: `${mark}%` }}
                    />
                )}
            </div>
            <span className={clsx('text-right tabular-nums', window.used >= 0.9 ? 'text-status-error' : 'text-text')}>{formatPercent(percent)}</span>
        </>
    );
}

function AccountLines({ account, now }: { account: LimitAccount; now: number }) {
    const { t } = useTranslation('agent-usage');
    const signedOut = isSignedOut(account);
    const note = signedOut ? null : accountNote(account);
    const windows = signedOut || note !== null ? [] : (account.entry?.windows ?? []);
    const next = nextReset(windows, now);
    const resetsIn = next === null ? null : resetInLabel(next.resetsAt, now);

    return (
        <>
            <p className="col-span-full mt-2 flex min-w-0 items-center gap-2">
                <AccountDot color={account.color} />
                <span className="truncate">{account.name}</span>
                {signedOut ? (
                    <span className="shrink-0 text-text-faint">· {t('limits.signedOut')}</span>
                ) : (
                    account.entry?.plan && <span className="shrink-0 text-text-muted">· {account.entry.plan}</span>
                )}
            </p>
            {note !== null && <p className="col-span-full text-text-faint">{note}</p>}
            {windows.map((window) => (
                <WindowLine key={window.id} window={window} now={now} />
            ))}
            {next !== null && (
                <p className="col-span-full whitespace-nowrap text-text-faint">
                    {t('limits.nextReset', { window: next.label, at: resetAtLabel(next.resetsAt, now) })}
                    {resetsIn !== null && ` · ${resetsIn}`}
                </p>
            )}
        </>
    );
}

/*
 * The hover card once a CLI has several accounts: a block per account, a line per window. One grid over
 * the whole card, so the bars of every account start and end at the same place whatever their labels.
 */
export function AccountLimitsList({ groups, now }: { groups: readonly LimitGroup[]; now: number }) {
    return (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-xs">
            {groups.map((group) => (
                <Fragment key={group.kind}>
                    <p className="col-span-full mt-3 flex items-center gap-2 font-medium first:mt-0">
                        <ChartLogo provider={group.kind} />
                        {PROVIDER_LABELS[group.kind]}
                    </p>
                    {group.accounts.map((account) => (
                        <AccountLines key={account.id} account={account} now={now} />
                    ))}
                </Fragment>
            ))}
        </div>
    );
}
