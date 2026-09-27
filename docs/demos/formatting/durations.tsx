import { formatAgo, formatClockDuration, formatCountdown, formatDuration, formatElapsedShort, useFormatLocale } from '@basmilius/react-ui/format';
import { PreferencesBar } from '../shared/preferences-bar.tsx';
import { Values } from '../shared/values.tsx';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export default function DurationsDemo() {
    useFormatLocale();

    return (
        <div className="flex w-full max-w-lg flex-col gap-4">
            <PreferencesBar />
            <Values
                rows={[
                    ['formatDuration(42_000)', formatDuration(42_000)],
                    ['formatDuration(90 * MINUTE)', formatDuration(90 * MINUTE)],
                    ['formatCountdown(4 * DAY + 3 * HOUR)', formatCountdown(4 * DAY + 3 * HOUR)],
                    ['formatCountdown(9 * MINUTE)', formatCountdown(9 * MINUTE)],
                    ['formatElapsedShort(125_000)', formatElapsedShort(125_000)],
                    ['formatElapsedShort(200 * MINUTE)', formatElapsedShort(200 * MINUTE)],
                    ['formatClockDuration(14_000)', formatClockDuration(14_000)],
                    ['formatClockDuration(HOUR + 62_000)', formatClockDuration(HOUR + 62_000)],
                    ['formatAgo(20_000)', formatAgo(20_000)],
                    ['formatAgo(3 * MINUTE)', formatAgo(3 * MINUTE)],
                    ['formatAgo(2 * DAY)', formatAgo(2 * DAY)]
                ]}
            />
        </div>
    );
}
