import { formatBytes, formatDecimal, formatMoney, formatNumber, formatPercent, formatTokens, formatUsdSignificant, useFormatLocale } from '@adecore/ui/format';
import { PreferencesBar } from '../shared/preferences-bar.tsx';
import { Values } from '../shared/values.tsx';

export default function NumbersDemo() {
    useFormatLocale();

    return (
        <div className="flex w-full max-w-lg flex-col gap-4">
            <PreferencesBar />
            <Values
                rows={[
                    ['formatNumber(1234567.8)', formatNumber(1234567.8)],
                    ['formatDecimal(1.25)', formatDecimal(1.25)],
                    ['formatPercent(4.25)', formatPercent(4.25)],
                    ['formatPercent(42.5)', formatPercent(42.5)],
                    ["formatMoney(5480.96, 'USD')", formatMoney(5480.96, 'USD')],
                    ["formatMoney(12, 'EUR', 0)", formatMoney(12, 'EUR', 0)],
                    ['formatUsdSignificant(0.004213)', formatUsdSignificant(0.004213)],
                    ['formatTokens(1234567)', formatTokens(1234567)],
                    ['formatTokens(412300)', formatTokens(412300)],
                    ['formatBytes(1536)', formatBytes(1536)],
                    ['formatBytes(52428800, true)', formatBytes(52428800, true)]
                ]}
            />
        </div>
    );
}
