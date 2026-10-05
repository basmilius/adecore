import { formatDayClock, formatLocale, formatNumber, formatPercent, useFormatLocale } from '@adecore/ui/format';
import { PreferencesBar } from '../shared/preferences-bar.tsx';
import { Values } from '../shared/values.tsx';

const AT = new Date(2026, 8, 19, 8, 5);

export default function FormatSourceDemo() {
    // Draws again whenever the language or the region changes.
    useFormatLocale();

    return (
        <div className="flex w-full max-w-lg flex-col gap-4">
            <PreferencesBar />
            <Values
                rows={[
                    ['formatLocale()', formatLocale()],
                    ['formatNumber(1234567)', formatNumber(1234567)],
                    ['formatPercent(4.25)', formatPercent(4.25)],
                    ['formatDayClock(at)', formatDayClock(AT)]
                ]}
            />
        </div>
    );
}
