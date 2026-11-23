// "Try again at 3:37 PM." for today, else "try again at Nov 11th, 2026 3:37 PM.", as Codex words a usage limit's reset.
const RESET_TEXT = /[Tt]ry again at (?:([A-Z][a-z]{2}) (\d{1,2})(?:st|nd|rd|th), (\d{4}) )?(\d{1,2}):(\d{2}) ([AP]M)\./;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HALF_DAY_MS = 12 * 3_600_000;

interface WallTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

/* The zone Codex prints its times in: the `TZ` of its environment, else the machine's own. */
export function codexTimeZone(tz: string | undefined): string {
    const named = tz?.replace(/^:/, '') ?? '';

    if (named !== '') {
        try {
            return new Intl.DateTimeFormat('en-US', { timeZone: named }).resolvedOptions().timeZone;
        } catch {
            // An unknown zone is one Codex cannot read either, so it falls back to the machine's own as well.
        }
    }

    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function wallTimeIn(at: number, zone: string): WallTime & { second: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }).formatToParts(new Date(at));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value);

    return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second') };
}

function offsetAt(at: number, zone: string): number {
    const wall = wallTimeIn(at, zone);

    return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - Math.floor(at / 1000) * 1000;
}

/* The instant a wall time in a zone names; the repeated hour of a fall-back takes its later instant, so a resume never fires early. */
function instantOf(wall: WallTime, zone: string): number {
    const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
    const before = offsetAt(naive - HALF_DAY_MS, zone);
    const after = offsetAt(naive + HALF_DAY_MS, zone);
    const valid = [naive - before, naive - after].filter((at) => naive - offsetAt(at, zone) === at);

    // A time in the gap of a spring-forward does not exist; the offset before the gap puts it just past it.
    return valid.length > 0 ? Math.max(...valid) : naive - before;
}

/*
 * The reset a usage limit's text names, in epoch milliseconds, read in Codex's zone against when the turn failed. It is
 * the only reset left when Codex sends no window that is spent. Null for a text without one, or one already past.
 */
export function codexTextResetAt(message: string, failedAt: number, zone: string): number | null {
    const match = RESET_TEXT.exec(message);

    if (match === null) {
        return null;
    }

    const [, month, day, year, hour, minute, meridiem] = match;
    const monthIndex = month === undefined ? null : MONTHS.indexOf(month);

    if (monthIndex === -1) {
        return null;
    }

    const today = wallTimeIn(failedAt, zone);

    const reset = instantOf(
        {
            year: monthIndex === null ? today.year : Number(year),
            month: monthIndex === null ? today.month : monthIndex + 1,
            day: monthIndex === null ? today.day : Number(day),
            hour: (Number(hour) % 12) + (meridiem === 'PM' ? 12 : 0),
            minute: Number(minute)
        },
        zone
    );

    // Codex drops the seconds, so the next minute is the first one past the reset.
    const resetAt = reset + 60_000;

    return resetAt > failedAt ? resetAt : null;
}
