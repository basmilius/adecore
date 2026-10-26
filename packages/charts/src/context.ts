import { createContext, useContext } from 'react';
import type { BandLayout } from './band.ts';
import type { AxisWidths } from './group-axes.ts';
import type { ContinuousXScale, Stacked, YAxisScale } from './scale.ts';
import type { BandEntry, ChartStore, MarkerEntry, SeriesEntry } from './store.ts';
import type { ChartNote, ChartRect, ChartX, ChartXScale } from './types.ts';

export interface ChartSlots {
    readonly legend: HTMLElement | null;
    readonly table: HTMLElement | null;
    readonly tooltip: HTMLElement | null;
    readonly groups: HTMLElement | null;
    readonly left: SVGGElement | null;
    readonly right: SVGGElement | null;
    /* Above the series in the plot, where `Chart.Rule` draws whatever its place among the children. */
    readonly rules: SVGGElement | null;
}

export interface ChartContextValue {
    readonly store: ChartStore;
    readonly label: string;
    readonly data: readonly unknown[];
    readonly xs: readonly ChartX[];
    readonly xScale: ChartXScale;
    readonly height: number;
    /* In the coordinates of the plot's own svg, which scrolls apart from the y axes. */
    readonly plot: ChartRect;
    readonly width: number;
    readonly band: BandLayout | null;
    readonly continuous: ContinuousXScale | null;
    readonly y: YAxisScale;
    readonly yStep: number;
    readonly series: ReadonlyMap<string, SeriesEntry>;
    readonly stacked: ReadonlyMap<string, Stacked>;
    readonly colors: ReadonlyMap<string, string>;
    /* Where a column of a `Chart.Bar` stands among the others in its bucket. */
    readonly slots: ReadonlyMap<string, { slot: number; count: number }>;
    readonly markers: ReadonlyMap<string, MarkerEntry>;
    readonly bands: ReadonlyMap<string, BandEntry>;
    readonly groupKeys: readonly string[] | null;
    /* What a person reads for the group of each bucket. */
    readonly groupLabels: readonly string[] | null;
    readonly activeIndex: number;
    /* False in a chart that draws the cursor of another chart of its group, which shows the tooltip itself. */
    readonly ownsCursor: boolean;
    readonly selected: readonly boolean[];
    readonly dimmed: readonly boolean[];
    /* Per bucket, whether the labels under it stand out with their column (`strong`), dim with it (`dim`) or neither. */
    readonly labelFocus: readonly ('strong' | 'dim' | null)[];
    /* The opacity a dimmed label takes, the same as its columns. */
    readonly labelDim: number;
    readonly elements: ChartSlots;
    /* The scroll of the plot, which the tooltip subtracts to stay at the cursor. */
    readonly scroll: number;
    /* The visible width of the chart, both y axes included. */
    readonly box: number;
    readonly leftAxis: number;
    readonly rightAxis: number;
    readonly centerOf: (index: number) => number;
    /* The span of a bucket a column stands in: on a band scale, or on a time scale with a step. */
    readonly bucketAt: (index: number) => { readonly left: number; readonly width: number } | null;
    readonly pixelOfX: (x: ChartX) => number | null;
    readonly pixelOfY: (value: number) => number | null;
    readonly setActiveX: (x: ChartX | null) => void;
    readonly formatX: (x: ChartX) => string;
    readonly formatY: (value: number) => string;
    /* The format of the root, which a y axis without one writes its ticks in; null without one. */
    readonly valueFormat: ((value: number) => string) | null;
    readonly notesAt: (index: number) => ChartNote[];
    /* A chart whose rows are points, not buckets. */
    readonly points: boolean;
    /* The key of every row of a point chart; null for buckets. */
    readonly keys: readonly string[] | null;
    readonly rowLabels: readonly string[] | null;
    /* Where each point stands, null for a gap. */
    readonly positions: readonly (readonly [number, number] | null)[];
    /* The series of a point chart, in the order they first appear, each with its rows in the order of the data. */
    readonly pointGroups: readonly { readonly key: string; readonly indexes: readonly number[] }[];
    /* The series whose points are all dimmed. */
    readonly dimmedGroups: ReadonlySet<string>;
    /* The categorical color of the series of a row, for a part without a tone of its own. */
    readonly groupColorOf: (index: number) => string;
    /* The color of a point as the part that places it draws it. */
    readonly pointColor: (index: number) => string;
    /* The x of a row as a person reads it, on a point chart with the title of the axis. */
    readonly xValueOf: (index: number) => string;
    readonly xTitle: string | null;
    /* The series a person reads in a bucket or a point: on a point chart one per label. */
    readonly readable: readonly (readonly [string, SeriesEntry])[];
    /* The surface under the chart, which the halo around a label and the ring of a point are drawn in. */
    readonly halo: string;
    /* The keyboard moved the cursor last, not the pointer. */
    readonly byKeyboard: boolean;
    /* The bucket or point the keyboard is on, apart from one the pointer passes over; -1 for none. */
    readonly keyIndex: number;
}

export const ChartContext = createContext<ChartContextValue | null>(null);

export function useChartContext(part: string): ChartContextValue {
    const context = useContext(ChartContext);

    if (context === null) {
        throw new Error(`${part} draws inside a Chart.Root.`);
    }

    return context;
}

/* The `Chart.Bars` a `Chart.Bar` is drawn in. */
export const BarsContext = createContext<{ id: string; stack: boolean } | null>(null);

export interface GroupCursor {
    readonly x: ChartX | null;
    /* The chart the pointer or the keyboard is in, the one that shows its tooltip. */
    readonly owner: string | null;
    readonly setX: (x: ChartX | null, owner: string) => void;
}

/* What the charts of a `Chart.Group` share: the cursor, the widths of their y axes, or both. */
export const GroupContext = createContext<{ cursor: GroupCursor | null; widths: AxisWidths | null } | null>(null);
