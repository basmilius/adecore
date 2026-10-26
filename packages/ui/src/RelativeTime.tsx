import type { Ref } from 'react';
import clsx from 'clsx';
import { formatAge, formatDayClockWithYear, useFormatLocale } from './format/index.ts';
import { Tooltip, type TooltipSide } from './Tooltip.tsx';
import { useNow } from './useNow.ts';

/* The finest step of an age is a minute, so half of one keeps it at most thirty seconds behind. */
const TICK_MS = 30_000;

export interface RelativeTimeProps {
    /* `null`, `undefined` or an invalid date for a moment that is not known, drawn as a dash. */
    at: Date | number | null | undefined;

    /* Off inside a row that is the focus target itself: no tab stop of its own, and the row shows the exact time. */
    tooltip?: boolean;

    tooltipSide?: TooltipSide;
    className?: string;
    ref?: Ref<HTMLElement>;
}

/* Counts on while it is on screen, with the exact time on hover and on keyboard focus. */
export function RelativeTime({ at, tooltip = true, tooltipSide, className, ref }: RelativeTimeProps) {
    // The formatters read the locale from a module, not from an input, so a compiled render would keep its first words.
    'use no memo';
    useFormatLocale();
    const now = useNow(TICK_MS);

    if (at === null || at === undefined || Number.isNaN(new Date(at).getTime())) {
        return (
            <span ref={ref} className={className}>
                -
            </span>
        );
    }

    if (!tooltip) {
        return (
            <time ref={ref as Ref<HTMLTimeElement>} dateTime={new Date(at).toISOString()} className={clsx('whitespace-nowrap', className)}>
                {formatAge(at, now)}
            </time>
        );
    }

    return (
        <Tooltip label={formatDayClockWithYear(at)} side={tooltipSide}>
            {/* Text is no tab stop of its own, and a hint that only the pointer can open is lost to the keyboard. */}
            <time
                ref={ref as Ref<HTMLTimeElement>}
                dateTime={new Date(at).toISOString()}
                tabIndex={0}
                className={clsx('focus-ring rounded-sm whitespace-nowrap', className)}
            >
                {formatAge(at, now)}
            </time>
        </Tooltip>
    );
}
