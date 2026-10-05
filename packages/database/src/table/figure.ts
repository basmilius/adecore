import { formatDecimal, formatNumber } from '@adecore/ui/format';

/*
 * A total or an average to at most two decimals, trailing zeros dropped: `39`, `1.95`, `1,234.5`.
 * `@adecore/ui/format` offers one decimal or none, so the fraction is written here, with the separator the region uses.
 */
export const formatFigure = (value: number): string => {
    const hundredths = Math.round(Math.abs(value) * 100);
    const whole = Math.floor(hundredths / 100);
    const fraction = hundredths % 100;
    const negative = value < 0 && hundredths > 0;
    const head = negative && whole === 0 ? '-0' : formatNumber(negative ? -whole : whole);
    if (fraction === 0) {
        return head;
    }
    const separator = formatDecimal(1.5).replace(/\d/g, '').charAt(0) || '.';
    return `${head}${separator}${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
};
