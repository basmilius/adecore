import { relativeFormatter } from './locale.ts';
import { formatDecimal, formatNumber, formatRounded } from './number.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* At the coarsest unit that still says something. The units stay English; only the number bends to the region (`1,5 h`). */
export const formatDuration = (ms: number): string => {
    const seconds = Math.max(0, Math.round(ms / SECOND));
    if (seconds < 60) {
        return `${formatNumber(seconds)} s`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${formatNumber(minutes)} min`;
    }
    return `${formatDecimal(minutes / 60)} h`;
};

/*
 * How long a short measurement took, below a second too: `0.4 ms`, `123 ms`, `1.42 s`, and as `formatDuration` from a
 * minute. Each unit rounds before it is chosen, so 999.6 ms reads as `1 s` and not as `1,000 ms`.
 */
export const formatPreciseDuration = (ms: number): string => {
    const value = Math.max(0, ms);
    const tenths = Math.round(value * 10) / 10;
    if (tenths < 10) {
        return `${formatRounded(tenths, 1)} ms`;
    }
    if (Math.round(value) < SECOND) {
        return `${formatNumber(Math.round(value))} ms`;
    }
    const hundredths = Math.round(value / 10) / 100;
    if (hundredths < 10) {
        return `${formatRounded(hundredths, 2)} s`;
    }
    const seconds = Math.round(value / 100) / 10;
    if (seconds < 60) {
        return `${formatRounded(seconds, 1)} s`;
    }
    return formatDuration(value);
};

/* How long a window still has, tight enough for the end of a bar: `4d 3h`, `12h 8m`, `9m`. */
export const formatCountdown = (ms: number): string => {
    const left = Math.max(0, ms);
    if (left >= DAY) {
        return `${formatNumber(Math.floor(left / DAY))}d ${formatNumber(Math.round((left % DAY) / HOUR))}h`;
    }
    if (left >= HOUR) {
        return `${formatNumber(Math.floor(left / HOUR))}h ${formatNumber(Math.round((left % HOUR) / MINUTE))}m`;
    }
    return `${formatNumber(Math.max(1, Math.round(left / MINUTE)))}m`;
};

/* `12s`, `2m 5s`, `3h 20m`. Anything above zero reads as at least `1s`; only a clock that runs ahead of the start comes out as `0s`. */
export const formatElapsedShort = (ms: number): string => {
    const seconds = ms <= 0 ? 0 : Math.max(1, Math.round(ms / SECOND));
    if (seconds < 60) {
        return `${formatNumber(seconds)}s`;
    }
    if (seconds < 3600) {
        const rest = seconds % 60;
        const minutes = Math.floor(seconds / 60);
        return rest === 0 ? `${formatNumber(minutes)}m` : `${formatNumber(minutes)}m ${formatNumber(rest)}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes === 0 ? `${formatNumber(hours)}h` : `${formatNumber(hours)}h ${formatNumber(minutes)}m`;
};

/* A stopwatch that is watched while it runs: `00:14`, and `1:02:03` once it passes an hour. */
export const formatClockDuration = (ms: number): string => {
    const seconds = Math.max(0, Math.floor(ms / SECOND));
    const pad = (value: number): string => String(value).padStart(2, '0');
    const clock = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
    const hours = Math.floor(seconds / 3600);
    return hours > 0 ? `${formatNumber(hours)}:${clock}` : clock;
};

const AGO: Intl.RelativeTimeFormatOptions = { style: 'narrow', numeric: 'always' };
const NOW: Intl.RelativeTimeFormatOptions = { style: 'narrow', numeric: 'auto' };

/* How long ago something was, short enough for the right edge of a row: `3m ago`, `3 min. geleden`. */
export const formatAgo = (ms: number): string => {
    const past = Math.max(0, ms);
    if (past < MINUTE) {
        return relativeFormatter(NOW).format(0, 'second');
    }
    if (past < HOUR) {
        return relativeFormatter(AGO).format(-Math.floor(past / MINUTE), 'minute');
    }
    if (past < DAY) {
        return relativeFormatter(AGO).format(-Math.floor(past / HOUR), 'hour');
    }
    return relativeFormatter(AGO).format(-Math.floor(past / DAY), 'day');
};
