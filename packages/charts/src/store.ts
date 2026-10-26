import type { IconProps } from '@adecore/ui';
import type { ChartCurve, ChartX } from './types.ts';

export interface SeriesEntry {
    readonly kind: 'line' | 'area' | 'bar' | 'point';
    readonly label: string;
    /* A CSS color, or null for the next color of the categorical series. */
    readonly color: string | null;
    /* A color per bucket, for columns colored by their row. */
    readonly rowColors: readonly string[] | null;
    readonly values: readonly (number | null)[];
    readonly stack: string | null;
    /* The `Chart.Bars` a column belongs to, which shares its bucket with the others in it. */
    readonly bars: string | null;
    readonly curve: ChartCurve;
    /* Drawn in the color of the series in place of its swatch. */
    readonly icon: IconProps['icon'] | null;
    /* Columns that write their value over them, which need a row of room above the plot. */
    readonly valueLabels: boolean;
    /* What a column dims to when it is out of focus, which the labels under it follow; columns only. */
    readonly dimOpacity?: number;
}

export interface RuleEntry {
    readonly value: number;
    readonly label: string;
}

export interface MarkerEntry {
    readonly at: ChartX;
    readonly label: string;
    readonly detail: string | null;
    readonly color: string;
}

export interface BandEntry {
    readonly from: ChartX;
    readonly to: ChartX;
    readonly label: string;
    readonly detail: string | null;
    readonly color: string;
}

export interface AxisSizes {
    /* The room end labels take right of the plot, inside its svg. */
    readonly end: number | null;
}

export type YAxisSide = 'left' | 'right';

/* A y axis on one side. Both sides read the one value scale, so each keeps its own ticks, title and format. */
export interface YAxisEntry {
    /* Null before its labels have been measured. */
    readonly width: number | null;
    readonly ticks: number | null;
    /* The room its title needs above the plot, null without one. */
    readonly top: number | null;
    readonly format: ((value: number) => string) | undefined;
}

/* One row of labels under the plot; the rows stack in the order of the children. */
export interface XAxisEntry {
    /* The height of the row. */
    readonly room: number;
    /* The widest label, which decides how many fit; null before the row has been measured. */
    readonly widest: number | null;
    readonly format: ((x: ChartX) => string) | undefined;
}

export interface ChartFormats {
    /* The title of the x axis, which names the x where a point is read out. */
    readonly xTitle?: string;
}

export interface ChartStore {
    subscribe(listener: () => void): () => void;
    series(): ReadonlyMap<string, SeriesEntry>;
    axes(): AxisSizes;
    xAxes(): ReadonlyMap<string, XAxisEntry>;
    yAxes(): ReadonlyMap<YAxisSide, YAxisEntry>;
    markers(): ReadonlyMap<string, MarkerEntry>;
    bands(): ReadonlyMap<string, BandEntry>;
    rules(): ReadonlyMap<string, RuleEntry>;
    formats(): ChartFormats;
    setSeries(id: string, entry: SeriesEntry | null): void;
    setAxis(axis: keyof AxisSizes, size: number | null): void;
    setXAxis(id: string, entry: XAxisEntry | null): void;
    setYAxis(side: YAxisSide, entry: YAxisEntry | null): void;
    setMarker(id: string, entry: MarkerEntry | null): void;
    setRule(id: string, entry: RuleEntry | null): void;
    setBand(id: string, entry: BandEntry | null): void;
    setFormat<Axis extends keyof ChartFormats>(axis: Axis, format: ChartFormats[Axis]): void;
}

const same = (one: unknown, other: unknown): boolean => {
    if (Array.isArray(one) && Array.isArray(other)) {
        return one.length === other.length && one.every((value, i) => Object.is(value, other[i]));
    }
    return Object.is(one, other);
};

const sameEntry = (one: object | undefined, other: object): boolean =>
    one !== undefined && Object.entries(other).every(([key, value]) => same((one as Record<string, unknown>)[key], value));

/*
 * What the parts tell the root. Each is a snapshot of its own that only changes when what is in it
 * does, so a part that registers the same values again changes nothing.
 */
export function createChartStore(): ChartStore {
    const listeners = new Set<() => void>();
    let axes: AxisSizes = { end: null };
    let formats: ChartFormats = {};

    const emit = (): void => {
        for (const listener of listeners) {
            listener();
        }
    };

    const keyed = <Key, Entry extends object>() => {
        let map: ReadonlyMap<Key, Entry> = new Map();
        return {
            get: (): ReadonlyMap<Key, Entry> => map,
            set: (id: Key, entry: Entry | null): void => {
                if (entry === null) {
                    if (!map.has(id)) {
                        return;
                    }
                    const next = new Map(map);
                    next.delete(id);
                    map = next;
                } else if (sameEntry(map.get(id), entry)) {
                    return;
                } else {
                    // A changed entry keeps its place, so a series keeps its color while its values change.
                    map = new Map(map).set(id, entry);
                }
                emit();
            }
        };
    };
    const series = keyed<string, SeriesEntry>();
    const xAxes = keyed<string, XAxisEntry>();
    const yAxes = keyed<YAxisSide, YAxisEntry>();
    const markers = keyed<string, MarkerEntry>();
    const rules = keyed<string, RuleEntry>();
    const bands = keyed<string, BandEntry>();

    return {
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        series: series.get,
        axes: () => axes,
        xAxes: xAxes.get,
        yAxes: yAxes.get,
        markers: markers.get,
        rules: rules.get,
        bands: bands.get,
        formats: () => formats,
        setSeries: series.set,
        setAxis(axis, size) {
            if (axes[axis] !== size) {
                axes = { ...axes, [axis]: size };
                emit();
            }
        },
        setXAxis: xAxes.set,
        setYAxis: yAxes.set,
        setRule: rules.set,
        setMarker: markers.set,
        setBand: bands.set,
        setFormat(axis, format) {
            if (formats[axis] !== format) {
                formats = { ...formats, [axis]: format };
                emit();
            }
        }
    };
}
