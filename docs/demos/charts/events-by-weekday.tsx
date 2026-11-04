import { Heatmap, type HeatmapCell } from '@adecore/charts';
import { formatClock, formatHour, formatNumber, formatWeekday, useFormatLocale } from '@adecore/ui/format';
import { useState } from 'react';
import { eventsPerWeekdayAndHour } from '../shared/heatmap-data.ts';

const counts = eventsPerWeekdayAndHour();
const total = counts.flat().reduce((sum, count) => sum + count, 0);

export default function EventsByWeekdayDemo() {
    useFormatLocale();
    const [active, setActive] = useState<HeatmapCell | null>(null);

    // 19 October 2026 is a Monday, so the rows start on Monday.
    const rows = Array.from({ length: 7 }, (_, day) => {
        const at = new Date(2026, 9, 19 + day);

        return { key: day, label: formatWeekday(at, 'long'), short: formatWeekday(at) };
    });

    const columns = Array.from({ length: 24 }, (_, hour) => {
        const at = new Date(2026, 9, 19, hour);

        return { key: hour, label: formatClock(at), short: hour % 6 === 0 ? formatHour(at) : null };
    });

    return (
        <div className="flex w-full max-w-2xl flex-col gap-2">
            <Heatmap rows={rows} columns={columns} values={counts} label="Error events per weekday and hour" valueLabel="Events" onActiveChange={setActive} />
            <p className="text-xs text-text-muted tabular-nums">
                {active === null
                    ? `${formatNumber(total)} events over 28 days, in your time zone`
                    : `${formatNumber(counts[active.row]![active.column]!)} events on ${rows[active.row]!.label} at ${columns[active.column]!.label}`}
            </p>
        </div>
    );
}
