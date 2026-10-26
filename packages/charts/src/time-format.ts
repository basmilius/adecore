import { formatClock, formatDay, formatDayClock } from '@adecore/ui/format';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type TimeLabel = 'clock' | 'dayClock' | 'day';

/*
 * How a time axis writes its ticks: the clock within a day, the day once the ticks are a day apart, and
 * both in between, where a clock alone would repeat every day. `step` is the time between two ticks.
 */
export function timeLabelOf(span: number, step: number): TimeLabel {
    if (step >= DAY) {
        return 'day';
    }

    return span <= DAY ? 'clock' : 'dayClock';
}

export function formatTime(at: number, label: TimeLabel): string {
    switch (label) {
        case 'clock':
            return formatClock(at);
        case 'dayClock':
            return formatDayClock(at);
        case 'day':
            return formatDay(at);
    }
}
