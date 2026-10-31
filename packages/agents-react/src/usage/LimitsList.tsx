import { Fragment } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UsageLimitsSnapshot, UsageWindow } from '@adecore/agent-contracts';
import { ChevronRight } from 'lucide-react';
import { limitsAccountId } from '../agents/account-limits';
import { accountColor } from '../agents/accounts';
import { ProviderLogo } from '../agents/ProviderLogo';
import { Icon, Tooltip } from '@adecore/ui';
import { formatClock, formatWeekdayClock, isSameDay, formatCountdown, formatPercent } from '@adecore/ui/format';
import { useChatHost } from '../host';
import { ChartLogo } from './ChartLogo';
import { PROVIDER_COLORS, PROVIDER_LABELS } from './format';
import {
    accountNote,
    emptyWindows,
    evenPace,
    explain,
    isSignedOut,
    limitAccountKey,
    noteIsWarning,
    paceText,
    ringWindows,
    type LimitAccount,
    type LimitGroup,
    type PaceStanding
} from './limit-groups';

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
            <div className={clsx('absolute inset-x-0 rounded-full bg-track', compact ? 'inset-y-1' : 'inset-y-1.5')} />
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
                            {provider.plan !== null && <span className="text-text-muted capitalize">· {provider.plan}</span>}
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

/* Red where a window is nearly spent, amber where it is worth knowing, in the color of a word. */
function textToneOf(used: number): string {
    return used >= 0.9 ? 'text-status-error' : used >= 0.7 ? 'text-status-needs-you' : 'text-text';
}

function strokeToneOf(used: number): string {
    return used >= 0.9 ? 'stroke-status-error' : used >= 0.7 ? 'stroke-status-needs-you' : 'stroke-text';
}

const WINDOW_LINE = 'grid grid-cols-[104px_minmax(0,1fr)_34px_50px] items-center gap-x-2';
const RING_RADII = [8.75, 5.25, 1.75];

/* One window on one line: the label, a thin bar with the elapsed mark, the percent, the time left. Fixed columns, so the bars of every account line up. */
function WindowLine({ window, now }: { window: UsageWindow; now: number }) {
    const { t } = useTranslation('agent-usage');
    const percent = Math.round(window.used * 100);
    const mark = evenPace(window, now)?.percent ?? null;
    const resetsIn = window.resetsAt === null ? null : resetInLabel(window.resetsAt, now);

    return (
        <div className={WINDOW_LINE}>
            <span className="truncate text-text-muted">{window.label}</span>
            <div
                role="progressbar"
                aria-label={t('limits.bar', { window: window.label, percent })}
                aria-valuenow={percent}
                aria-valuetext={paceText(window, now)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-1.5 rounded-full bg-track"
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
            <span className={clsx('text-right tabular-nums', textToneOf(window.used))}>{formatPercent(percent)}</span>
            <span className="text-right whitespace-nowrap text-text-faint tabular-nums">{resetsIn ?? '-'}</span>
        </div>
    );
}

/* A window this account has not reported on: no number to draw, so an empty bar and a dash. */
function EmptyWindowLine({ label }: { label: string }) {
    return (
        <div className={WINDOW_LINE}>
            <span className="truncate text-text-muted">{label}</span>
            <div className="h-1.5 rounded-full bg-track" />
            <span className="text-right text-text-faint">-</span>
            <span className="text-right text-text-faint">-</span>
        </div>
    );
}

/* A ring per window, what a folded account keeps of its bars. The largest is the first window. */
function WindowRings({ windows, empty }: { windows: readonly UsageWindow[]; empty: boolean }) {
    const { t } = useTranslation('agent-usage');
    const rings = ringWindows(windows);
    const label = rings.map((window) => t('limits.bar', { window: window.label, percent: Math.round(window.used * 100) })).join(', ');

    return (
        <svg
            viewBox="0 0 20 20"
            width="20"
            height="20"
            fill="none"
            strokeWidth="2.5"
            role={empty ? undefined : 'img'}
            aria-hidden={empty ? true : undefined}
            aria-label={empty ? undefined : label}
            className={clsx('ml-auto shrink-0', empty && 'opacity-50')}
        >
            {rings.map((window, index) => {
                const radius = RING_RADII[index] ?? 0;
                const circumference = 2 * Math.PI * radius;

                return (
                    <Fragment key={window.id}>
                        <circle cx="10" cy="10" r={radius} className="stroke-track" />
                        {!empty && (
                            <circle
                                cx="10"
                                cy="10"
                                r={radius}
                                strokeDasharray={`${Math.min(1, window.used) * circumference} ${circumference}`}
                                transform="rotate(-90 10 10)"
                                className={strokeToneOf(window.used)}
                            />
                        )}
                    </Fragment>
                );
            })}
        </svg>
    );
}

function AccountLogo({ account, className }: { account: LimitAccount; className?: string }) {
    const { accents } = useChatHost();

    return (
        <span className={className} style={{ color: accountColor(account.color, accents.all) ?? PROVIDER_COLORS[account.kind] }}>
            <ProviderLogo provider={account.kind} />
        </span>
    );
}

interface AccountRowProps {
    group: LimitGroup;
    account: LimitAccount;
    now: number;
    folded: boolean;
    onToggle: () => void;
}

/* One account: a row that folds its windows away, or only a row with the words for why it has none. */
function AccountRow({ group, account, now, folded, onToggle }: AccountRowProps) {
    const { t } = useTranslation('agent-usage');
    const empty = emptyWindows(group, account);
    const note = isSignedOut(account) ? t('limits.signedOut') : accountNote(account);

    if (note !== null && empty.length === 0) {
        return (
            <p className="flex min-h-7 min-w-0 items-center gap-2 px-1.5">
                <AccountLogo account={account} className="grid size-3.5 shrink-0" />
                <span className="max-w-1/2 shrink-0 truncate font-medium">{account.name}</span>
                <span className={clsx('ml-auto min-w-0 text-right', noteIsWarning(account) ? 'text-status-needs-you' : 'text-text-faint')}>{note}</span>
            </p>
        );
    }

    const windows = empty.length > 0 ? empty : (account.entry?.windows ?? []);

    return (
        <div className="flex flex-col">
            <button
                type="button"
                aria-expanded={!folded}
                className="group flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left hover:bg-surface-hover focus-visible:bg-surface-hover"
                onClick={onToggle}
            >
                <span className="grid size-3.5 shrink-0">
                    <AccountLogo account={account} className="grid group-hover:hidden group-focus-visible:hidden" />
                    <Icon
                        icon={ChevronRight}
                        size={14}
                        className={clsx('hidden text-text-muted group-hover:block group-focus-visible:block', !folded && 'rotate-90')}
                    />
                </span>
                <span className="min-w-0 truncate font-medium">{account.name}</span>
                {account.entry?.plan && <span className="shrink-0 text-text-muted capitalize">{account.entry.plan}</span>}
                {folded && <WindowRings windows={windows} empty={empty.length > 0} />}
            </button>
            {!folded && (
                <div className="flex flex-col gap-0.75 pt-0.5 pr-1.5 pb-2 pl-7">
                    {empty.length > 0
                        ? empty.map((window) => <EmptyWindowLine key={window.id} label={window.label} />)
                        : windows.map((window) => <WindowLine key={window.id} window={window} now={now} />)}
                </div>
            )}
        </div>
    );
}

interface AccountLimitsListProps {
    groups: readonly LimitGroup[];
    now: number;
    /* The accounts folded to their row, by `limitAccountKey`; held by the caller, so they stay folded when the list is drawn again. */
    folded: ReadonlySet<string>;
    onFoldedChange: (folded: ReadonlySet<string>) => void;
}

/* A flat list of accounts for a hover card, whichever CLI they belong to; the logo says which. */
export function AccountLimitsList({ groups, now, folded, onFoldedChange }: AccountLimitsListProps) {
    const toggle = (key: string) => {
        const next = new Set(folded);

        if (!next.delete(key)) {
            next.add(key);
        }

        onFoldedChange(next);
    };

    return (
        <div className="flex flex-col gap-0.5 text-xs">
            {groups.flatMap((group) =>
                group.accounts.map((account) => {
                    const key = limitAccountKey(account);

                    return <AccountRow key={key} group={group} account={account} now={now} folded={folded.has(key)} onToggle={() => toggle(key)} />;
                })
            )}
        </div>
    );
}
