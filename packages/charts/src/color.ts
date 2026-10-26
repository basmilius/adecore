import type { ChartColor, ChartTone } from './types.ts';

const TONES: Record<ChartTone, string> = {
    accent: 'var(--accent)',
    error: 'var(--status-error)',
    needsYou: 'var(--status-needs-you)',
    idle: 'var(--status-idle)',
    running: 'var(--status-running)',
    muted: 'var(--text-faint)'
};

/* The CSS color of a tone or of an app's own color; `undefined` leaves the series to the categorical order. */
export function colorOf(tone: ChartColor | undefined): string | null {
    if (tone === undefined) {
        return null;
    }

    return typeof tone === 'string' ? TONES[tone] : tone.color;
}

/* The n-th color of the categorical series of the theme, `--chart-1` to `--chart-6`, round again after six. */
export function seriesColor(index: number): string {
    return `var(--chart-${(index % 6) + 1})`;
}
