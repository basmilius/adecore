import { useState } from 'react';
import { Chart, type ChartX } from '@adecore/charts';
import { formatClock, formatPercent } from '@adecore/ui/format';

const WINDOW = 10 * 60_000;
const END = Date.UTC(2026, 9, 24, 14, 30);

/* A sample every 10 seconds of the last ten minutes: the whole machine and the share of one app in it, with a stretch nobody measured. */
const samples = Array.from({ length: 61 }, (_, index) => {
    const at = END - WINDOW + index * 10_000;
    const unmeasured = index >= 24 && index < 28;
    const machine = 38 + 22 * Math.sin(index / 6) + (index % 7) * 2;

    return { at, machine: unmeasured ? null : machine, app: unmeasured ? null : machine * (0.35 + 0.15 * Math.cos(index / 9)) };
});

export default function ProcessLoadDemo() {
    const [hovered, setHovered] = useState<ChartX | null>(null);
    const sample = samples.find((entry) => entry.at === hovered);
    const latest = samples.at(-1)!;
    const write = (value: number | null): string => (value === null ? '-' : formatPercent(value));

    return (
        <div className="flex w-full max-w-80 flex-col gap-1">
            <div className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-text-muted">CPU</span>
                <span className="grow" />
                <span className="truncate text-text tabular-nums">
                    {sample === undefined ? write(latest.machine) : `${formatClock(sample.at)}: ${write(sample.machine)}, this app ${write(sample.app)}`}
                </span>
            </div>
            <Chart.Root
                data={samples}
                x="at"
                xScale="time"
                step={0}
                xOptions={{ min: END - WINDOW, max: END }}
                y={{ min: 0, max: 100 }}
                height={44}
                margin={{ top: 1, right: 0, bottom: 1, left: 0 }}
                interactive={false}
                cursor="line"
                label="CPU of the machine and of this app, the last ten minutes"
                onActiveXChange={setHovered}
                className="w-full"
            >
                <Chart.Grid lines="ground" dashed />
                <Chart.Area value="app" label="This app" tone="accent" width={0} fill="flat" />
                <Chart.Line value="machine" label="Machine" tone={{ color: 'var(--text-muted)' }} width={1} />
            </Chart.Root>
        </div>
    );
}
