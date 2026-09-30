import { Meter, useNow } from '@basmilius/desktop-ui';
import { formatDecimal, formatPercent } from '@basmilius/desktop-ui/format';

const FLOOR = -40;
const TOP = -4;
const TARGET = -14;

// A loudness that swells and dips, as a song under the playhead would.
const loudnessAt = (seconds: number, speed: number): number => -20 + 7 * Math.sin(seconds * speed) + 3 * Math.sin(seconds * speed * 3.7);

export default function MeterDemo() {
    const now = useNow(100);
    const seconds = now / 1000;
    const rows = [
        { letter: 'M', name: 'Momentary loudness', loudness: loudnessAt(seconds, 2.3) },
        { letter: 'S', name: 'Short-term loudness', loudness: loudnessAt(seconds, 0.6) }
    ];

    return (
        <div className="flex w-full max-w-xs flex-col gap-6">
            <div role="group" aria-label={`Loudness against ${TARGET} LUFS`} className="flex flex-col gap-0.5">
                {rows.map((row) => (
                    <div key={row.letter} className="flex items-center gap-1.5 text-xs">
                        <span aria-hidden className="w-2.5 text-text-faint">
                            {row.letter}
                        </span>
                        <Meter
                            value={row.loudness}
                            min={FLOOR}
                            max={TOP}
                            marks={[TARGET]}
                            label={row.name}
                            valueText={`${formatDecimal(row.loudness)} LUFS`}
                            className="flex-1"
                        />
                        <span aria-hidden className="w-8 text-right text-text-muted tabular-nums">
                            {formatDecimal(row.loudness)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-text-muted">
                    <span>Storage</span>
                    <span className="tabular-nums">{formatPercent(62)}</span>
                </div>
                <Meter value={62} marks={[80]} label="Storage" valueText={`${formatPercent(62)} used`} />
            </div>
        </div>
    );
}
