import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { UsageWindow } from '@adecore/agent-contracts';
import { formatClock, formatPercent, formatWeekdayClock, isSameDay } from '@adecore/ui/format';
import { evenPace, paceText } from '../../usage/limit-groups';

/* Red where a window is nearly spent, amber where it is worth knowing, as the usage bars have it. */
function sessionTone(used: number): { bar: string; text: string } {
    return used >= 0.9
        ? { bar: 'bg-status-error', text: 'text-status-error' }
        : used >= 0.7
          ? { bar: 'bg-status-needs-you', text: 'text-status-needs-you' }
          : { bar: 'bg-text-muted', text: 'text-text-muted' };
}

/* How much of an account's session is spent and when it resets, on the second line of a row that names the account. */
export function SessionLine({ window, now }: { window: UsageWindow; now: number }) {
    const { t } = useTranslation('agent-chat');
    const percent = Math.round(window.used * 100);
    const tone = sessionTone(window.used);
    const mark = evenPace(window, now)?.percent ?? null;
    const resetsAt = window.resetsAt;
    return (
        <span className="flex items-center gap-2 text-xs text-text-faint tabular-nums">
            <span aria-hidden className="relative h-1 w-14 shrink-0 rounded-full bg-surface-sunken">
                <span className={clsx('absolute inset-y-0 left-0 rounded-full', tone.bar)} style={{ width: `${Math.min(100, percent)}%` }} />
                {/* Where an even spread over the window would stand, as the usage bars mark it. */}
                {mark !== null && (
                    <span
                        className={clsx('absolute -inset-y-0.5 w-px -translate-x-1/2', mark <= percent ? 'bg-surface-raised' : 'bg-text-muted')}
                        style={{ left: `${mark}%` }}
                    />
                )}
            </span>
            <span aria-hidden className={tone.text}>
                {formatPercent(percent)}
            </span>
            <span className="sr-only">{paceText(window, now)}</span>
            {resetsAt !== null && (
                <span className="whitespace-nowrap">
                    · {t('pickers.account.resets', { time: isSameDay(resetsAt, now) ? formatClock(resetsAt) : formatWeekdayClock(resetsAt) })}
                </span>
            )}
        </span>
    );
}
