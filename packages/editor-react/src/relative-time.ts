import { formatAgo, formatDay, formatDayWithYear } from '@adecore/ui/format';

export function relativeTime(at: number, now: number): string {
    const seconds = Math.max(0, now - at);
    if (seconds < 7 * 24 * 60 * 60) {
        return formatAgo(seconds * 1000);
    }
    const date = new Date(at * 1000);
    return date.getFullYear() === new Date(now * 1000).getFullYear() ? formatDay(date) : formatDayWithYear(date);
}
