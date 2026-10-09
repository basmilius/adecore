import type { UiProps } from '@adecore/intelligent-ui';

/* The catalog promises up to six series, one per chart color. */
export const UI_CHART_SERIES = 6;
/* Categories a chart draws; more would not fit a column of a thread. */
export const UI_CHART_ROWS = 60;

export interface UiChartSeries {
    key: string;
    /* One per label, null where a row has no number for this series. */
    values: (number | null)[];
}

export interface UiChartData {
    labels: string[];
    series: UiChartSeries[];
    /* The range the axis covers, from zero or below it, never empty. */
    min: number;
    max: number;
    /* Whether rows past `UI_CHART_ROWS` were left out. */
    truncated: boolean;
}

/*
 * The series a chart can draw: every key besides `label` with a finite number in some row, the
 * first six of them. A value that is missing or no finite number is a gap. Null when there is no
 * row or no series, which draws the fallback.
 */
export function uiChartData(data: UiProps<'Chart'>['data'], kind: UiProps<'Chart'>['kind']): UiChartData | null {
    const rows = data.slice(0, UI_CHART_ROWS);
    const keys: string[] = [];
    for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
            if (key !== 'label' && !keys.includes(key) && keys.length < UI_CHART_SERIES && typeof value === 'number' && Number.isFinite(value)) {
                keys.push(key);
            }
        }
    }
    if (rows.length === 0 || keys.length === 0) {
        return null;
    }
    const series = keys.map((key) => ({
        key,
        values: rows.map((row) => {
            const value = row[key];
            return typeof value === 'number' && Number.isFinite(value) ? value : null;
        })
    }));
    const labels = rows.map((row) => (typeof row.label === 'string' || typeof row.label === 'number' ? String(row.label) : ''));
    const extents =
        kind === 'stacked'
            ? labels.map((_, index) => series.reduce((sum, { values }) => sum + Math.max(0, values[index] ?? 0), 0))
            : series.flatMap(({ values }) => values.filter((value) => value !== null));
    const min = Math.min(0, ...extents);
    const max = Math.max(0, ...extents);
    return { labels, series, min, max: max === min ? min + 1 : max, truncated: data.length > rows.length };
}

/* A round number at or above `value`, for the top of an axis: 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeiling(value: number): number {
    if (value <= 0) {
        return 0;
    }
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= value) ?? 10;
    return step * power;
}
