import { useChartContext } from './context.ts';
import type { ChartRect, ChartX } from './types.ts';

/* What a drawing of the app's own reads to stand on the same axes as the chart around it. */
export interface ChartApi<Row> {
    /* In the coordinates of the plot's svg, which is what `Chart.Layer` draws in. */
    readonly plot: ChartRect;
    readonly data: readonly Row[];
    /* The pixel of an x: the center of its bucket on a band scale. Null for an x the chart does not have. */
    readonly x: (value: ChartX) => number | null;
    /* The pixel of a value, null for one a log scale cannot show. */
    readonly y: (value: number) => number | null;
    readonly yTicks: readonly number[];
    /* The width of one bucket of a band scale, 0 on a continuous one. */
    readonly bandwidth: number;
    readonly activeIndex: number | null;
    readonly activeRow: Row | null;
    readonly setActiveX: (x: ChartX | null) => void;
}

/* The plot, the scales, the data and the cursor of the chart around it. */
export function useChart<Row = unknown>(): ChartApi<Row> {
    const chart = useChartContext('useChart');
    const active = chart.activeIndex >= 0 ? chart.activeIndex : null;

    return {
        plot: chart.plot,
        data: chart.data as Row[],
        x: chart.pixelOfX,
        y: chart.pixelOfY,
        yTicks: chart.y.ticks,
        bandwidth: chart.band?.bucket ?? 0,
        activeIndex: active,
        activeRow: active === null ? null : (chart.data[active] as Row),
        setActiveX: chart.setActiveX
    };
}
