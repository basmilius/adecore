import { formatAgo } from './duration.ts';
import { dateFormatter, wordFormatter } from './locale.ts';

/* The parts that are a word rather than a number, and so come from the language and not the region. */
const WORD_PARTS = new Set<Intl.DateTimeFormatPartTypes>(['month', 'weekday', 'dayPeriod', 'era']);

const toDate = (at: Date | number): Date => (typeof at === 'number' ? new Date(at) : at);

/*
 * The region's notation with the language's words: `19 Sep` in English against a Dutch region. Both
 * formatters get the same options and instant, so every word part has one to lift, whatever the order.
 */
export const formatDateTime = (at: Date | number, options: Intl.DateTimeFormatOptions): string => {
    const date = toDate(at);
    const parts = dateFormatter(options).formatToParts(date);

    if (!parts.some((part) => WORD_PARTS.has(part.type))) {
        return parts.map((part) => part.value).join('');
    }

    const words = wordFormatter(options).formatToParts(date);

    return parts.map((part) => (WORD_PARTS.has(part.type) ? (words.find((word) => word.type === part.type)?.value ?? part.value) : part.value)).join('');
};

const CLOCK: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const WEEKDAY_CLOCK: Intl.DateTimeFormatOptions = { weekday: 'short', hour: '2-digit', minute: '2-digit' };
const HOUR: Intl.DateTimeFormatOptions = { hour: 'numeric' };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: 'short' };
const WEEKDAY_LONG: Intl.DateTimeFormatOptions = { weekday: 'long' };
const DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const DAY_WITH_YEAR: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
const WEEKDAY_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
const DAY_CLOCK: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
const DAY_CLOCK_WITH_YEAR: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
const NUMERIC_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

const zonedSpecs = new WeakMap<Intl.DateTimeFormatOptions, Map<string, Intl.DateTimeFormatOptions>>();

/* One options object per zone, so the formatter cached on it is built once (`dateFormatter`). */
const zoned = (options: Intl.DateTimeFormatOptions, timeZone: string | undefined): Intl.DateTimeFormatOptions => {
    if (timeZone === undefined) {
        return options;
    }

    let byZone = zonedSpecs.get(options);

    if (byZone === undefined) {
        byZone = new Map();
        zonedSpecs.set(options, byZone);
    }

    let spec = byZone.get(timeZone);

    if (spec === undefined) {
        spec = { ...options, timeZone };
        byZone.set(timeZone, spec);
    }

    return spec;
};

/*
 * `08:05`, or `08:05 AM` in a region that counts to twelve. A `timeZone` such as `UTC` writes a moment
 * whose parts are given and mean the same wall clock anywhere.
 */
export const formatClock = (at: Date | number, timeZone?: string): string => formatDateTime(at, zoned(CLOCK, timeZone));

/* A time far enough off that its day is part of the answer: `Sat 08:05`. */
export const formatWeekdayClock = (at: Date | number): string => formatDateTime(at, WEEKDAY_CLOCK);

/* An hour of the day on its own, for the foot of a chart: `08`, or `8 AM` where that is the clock. */
export const formatHour = (at: Date | number): string => formatDateTime(at, HOUR);

/* The day of the week on its own, for the side of a grid by weekday: `Sat`, or `Saturday` when `long`. */
export const formatWeekday = (at: Date | number, width: 'short' | 'long' = 'short'): string => formatDateTime(at, width === 'long' ? WEEKDAY_LONG : WEEKDAY);

/* `19 Sep`, the short date a row falls back to once "days ago" stops meaning anything. */
export const formatDay = (at: Date | number, timeZone?: string): string => formatDateTime(at, zoned(DAY, timeZone));

/* The same date with the year, for anything older than the one we are in. */
export const formatDayWithYear = (at: Date | number, timeZone?: string): string => formatDateTime(at, zoned(DAY_WITH_YEAR, timeZone));

/* `Sat 19 Sep`. */
export const formatWeekdayDay = (at: Date | number): string => formatDateTime(at, WEEKDAY_DAY);

/* `19 Sep, 08:05`: a moment that is not today, to the minute. */
export const formatDayClock = (at: Date | number, timeZone?: string): string => formatDateTime(at, zoned(DAY_CLOCK, timeZone));

/* `19 Sep 2026, 08:05`: the same moment with the year. */
export const formatDayClockWithYear = (at: Date | number, timeZone?: string): string => formatDateTime(at, zoned(DAY_CLOCK_WITH_YEAR, timeZone));

/* All numbers, as a form would print it: `19-9-2026` here, `9/19/2026` in the United States. */
export const formatNumericDate = (at: Date | number): string => formatDateTime(at, NUMERIC_DATE);

/* In the zone of whoever is reading. */
export const isSameDay = (a: Date | number, b: Date | number): boolean => {
    const left = toDate(a);
    const right = toDate(b);

    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
};

export const formatMoment = (at: Date | number, now: Date | number = Date.now()): string => (isSameDay(at, now) ? formatClock(at) : formatDayClock(at));

const WEEK = 7 * 24 * 60 * 60 * 1000;

/*
 * How old a row is, for its right edge: `3d ago` for the first week, then the day, with the year once
 * it is not this one. An `at` ahead of `now`, from a clock that runs ahead, reads as now.
 */
export const formatAge = (at: Date | number, now: Date | number = Date.now()): string => {
    const date = toDate(at);
    const today = toDate(now);
    const past = today.getTime() - date.getTime();

    if (past < WEEK) {
        return formatAgo(past);
    }

    return date.getFullYear() === today.getFullYear() ? formatDay(date) : formatDayWithYear(date);
};
