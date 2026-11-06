import type { SeriesEntry } from './store.ts';
import type { ChartRect } from './types.ts';

/* What a part draws, which a layout may leave out: the kinds of series, and the annotations and labels that lie across the buckets. */
export type Drawn = SeriesEntry['kind'] | 'marker' | 'band' | 'groups';

/* A segment across the plot, in the coordinates of its svg. */
export interface PlotLine {
    readonly x1: number;
    readonly x2: number;
    readonly y1: number;
    readonly y2: number;
}

export interface RuleLabel {
    readonly x: number;
    readonly y: number;
    readonly dy?: string;
    readonly anchor: 'start' | 'end';
}

/*
 * How the buckets and the values lie on the plot. A part asks the plane where its lines and labels go
 * and what it may draw, so none of them branches on the orientation.
 */
export interface ChartPlane {
    readonly draws: (part: Drawn) => boolean;
    /* The line at a pixel of the value axis, across the buckets. */
    readonly valueLine: (plot: ChartRect, pixel: number) => PlotLine;
    /* The line at a pixel of the bucket axis, across the values. */
    readonly bucketLine: (plot: ChartRect, pixel: number) => PlotLine;
    /* Where the label of a reference line goes: `pixel` is where the line crosses the value axis. */
    readonly ruleLabel: (plot: ChartRect, pixel: number) => RuleLabel;
}

/* A line one pixel wide is drawn on the middle of a pixel, so it stays sharp. */
export const crisp = (pixel: number): number => Math.round(pixel) + 0.5;

/* Room a label needs above its line before it moves under it instead. */
const RULE_LABEL = 18;
/* Between the line and the label it carries, above it or below it. */
const RULE_GAP = 7;
/* Between the line and the label it carries, beside it. */
const RULE_SIDE = 4;

const across = (plot: ChartRect, pixel: number): PlotLine => ({ x1: plot.left, x2: plot.right, y1: pixel, y2: pixel });

const upright = (plot: ChartRect, pixel: number): PlotLine => ({ x1: pixel, x2: pixel, y1: plot.top, y2: plot.bottom });

/* The buckets are columns along the bottom and the values run up. */
export const COLUMNS: ChartPlane = {
    draws: () => true,
    valueLine: across,
    bucketLine: upright,
    ruleLabel: (plot, pixel) => {
        const below = crisp(pixel) - RULE_LABEL < 0;

        return { x: Math.round(plot.right), y: Math.round(pixel) + (below ? RULE_GAP : -RULE_GAP), ...(below ? { dy: '0.8em' } : {}), anchor: 'end' };
    }
};

/*
 * The buckets are rows down the chart and the values run to the right. Only columns turn into rows: a line, a
 * point, a marker or a band across rows would read nothing a bar does not.
 */
export const ROWS: ChartPlane = {
    draws: (part) => part === 'bar',
    valueLine: upright,
    bucketLine: across,
    ruleLabel: (plot, pixel) => {
        // Above the plot, on the side of the line that has the room, so it never covers the bars of the first row.
        const anchor = pixel > (plot.left + plot.right) / 2 ? 'end' : 'start';

        return { x: Math.round(pixel) + (anchor === 'end' ? RULE_SIDE : -RULE_SIDE), y: plot.top - RULE_GAP, anchor };
    }
};
