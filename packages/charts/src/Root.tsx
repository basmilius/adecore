import {
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
    type Ref
} from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useContentSize } from '@adecore/ui';
import { formatNumber, formatRounded } from '@adecore/ui/format';
import { readValue, warnMissingKey, warnOnce, xOf } from './access.ts';
import { LABEL_GAP as X_AXIS_GAP } from './axes.tsx';
import { bandLayout, GROUP_GAP } from './band.ts';
import { seriesColor } from './color.ts';
import { ChartContext, GroupContext, type ChartContextValue } from './context.ts';
import { containingIndex, keyIndexOf, moveIndex, nearestIndex, snapIndex } from './cursor.ts';
import { useAlignedAxes } from './group-axes.ts';
import { movePoint, nearestPoint, type PlacedPoint } from './points.ts';
import { bucketStepOf, continuousXScale, extentOf, pointXScale, stackSeries, tickCount, yScaleOf } from './scale.ts';
import { createChartStore } from './store.ts';
import { formatTime, timeLabelOf } from './time-format.ts';
import type { ChartAccessor, ChartMargin, ChartNote, ChartRows, ChartX, ChartXInput, ChartXOptions, ChartXScale, ChartYOptions, ChartYScale } from './types.ts';

export interface ChartRootProps<Row> {
    /* One row per bucket. On a time or linear scale the rows run from the lowest x to the highest; points come in any order. */
    readonly data: readonly Row[];
    /* A missing x or value makes a point a gap, which breaks its line. */
    readonly x: ChartAccessor<Row, ChartXInput | null | undefined>;
    readonly xScale?: ChartXScale;
    /*
     * What a row is. `points` places each row at its x and the value of the first `Chart.Point` or `Chart.Line`,
     * `group` puts them in series, and the cursor, the keyboard and `onActivate` work per point.
     */
    readonly rows?: ChartRows;
    /* The key of a row of a point chart, for `selected`, `activeX` and `onActiveXChange`; its index by default. */
    readonly rowKey?: ChartAccessor<Row, string>;
    /*
     * What a person reads for a row: beside its group on a point chart, such as the effort of a model, and in place of
     * the x of a bucket in the tooltip, the live region and the table, such as "Low" under an axis that writes "L".
     */
    readonly rowLabel?: ChartAccessor<Row, string>;
    /* Writes a value in the tooltip, the live region and the table, and on a y axis without a format of its own. */
    readonly format?: (value: number) => string;
    /* Fixed ends of a time, linear or log x axis, such as a window that ends now. */
    readonly xOptions?: ChartXOptions;
    /*
     * The length of a bucket on a time scale, in milliseconds; the smallest distance between two rows by default.
     * 0 makes every row a sample at its moment: its point stands at its x and the cursor takes the nearest.
     */
    readonly step?: number;
    readonly yScale?: ChartYScale;
    /* Fixed ends of the value axis; without them it covers every series and rounds out to a tick. */
    readonly y?: ChartYOptions;
    /* The name of the chart, for a screen reader and the table of values. */
    readonly label: string;
    /*
     * `horizontal` turns the buckets of a band scale into rows down the chart, a name on the left and a bar running to
     * the right, for ranked categories with long names. The x is still the bucket and the y still the value.
     */
    readonly orientation?: 'vertical' | 'horizontal';
    /* The pixels a row of a horizontal chart takes, which the height follows in place of `height`. */
    readonly rowHeight?: number;
    /* In pixels, the x axis included; with `grow` the least height. The width follows the container. */
    readonly height?: number;
    /* Takes the height its container gives it, never less than `height`, such as a chart that fills a panel. */
    readonly grow?: boolean;
    /* Controls the cursor. Leaving the chart calls `onActiveXChange(null)` and leaves the cursor to the app. */
    readonly activeX?: ChartX | null;
    readonly onActiveXChange?: (x: ChartX | null) => void;
    /*
     * Room around the plot. `top` (8) is for something drawn over it, at least 24 with value labels over columns; `bottom`
     * is 4; `left` and `right` are 6 on a continuous scale without buckets, so the dot at the end of a line keeps its edge.
     */
    readonly margin?: ChartMargin;
    /* The surface the chart stands on, such as `raised` in a dialog, which the halo around its labels and the ring of a point take. */
    readonly surface?: 'base' | 'raised';
    /* Puts the buckets of a band scale into runs of the same key, with a gap between them, or the points into series. */
    readonly group?: ChartAccessor<Row, string>;
    /* What the tooltip, the live region and the table call a group, read from its rows; its key by default. */
    readonly groupLabel?: ChartAccessor<Row, string>;
    /* The pixels between two groups; the first and the last group keep half of it to the edge. */
    readonly groupGap?: number;
    /* The narrowest a bucket of a band scale may be; below that the plot scrolls sideways under a y axis that stays. */
    readonly minBucketWidth?: number;
    /* The x of every bucket that is picked, or the key of every point, which stays highlighted and is pressed for a screen reader. */
    readonly selected?: readonly ChartX[];
    /*
     * False makes a chart that only decorates an image with its `label`: no tab stop, no keys and no live region. The
     * pointer still moves the cursor and the tooltip.
     */
    readonly interactive?: boolean;
    /*
     * What marks the cursor: a lit bucket on a band scale and a line with a dot on every series on a time or linear one
     * (`full`), the line alone (`line`), or nothing past what the columns and the tooltip show (`none`).
     */
    readonly cursor?: 'full' | 'line' | 'none';
    /* Makes the buckets or the points pressable: Enter, Space and a click. */
    readonly onActivate?: (row: Row, index: number) => void;
    /* The buckets or points the app wants out of focus. A series whose points are all dimmed dims its line and end label. */
    readonly dimmed?: (row: Row, index: number) => boolean;
    readonly children?: ReactNode;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/* Room for the dot at the end of a line on a continuous scale, which would otherwise stand on the edge. */
const INSET = 6;
const Y_TICK_SPACING = 40;
/* How far from a point the pointer may be and still take it. */
const POINT_REACH = 16;
/* One row of value labels over the tallest column; labels pushed up a row further need a larger `margin.top`. */
const VALUE_LABEL_ROOM = 24;
const ROW_HEIGHT = 32;
/* Ticks under a horizontal plot stand apart by the width of a label, which takes more room than its line beside a plot. */
const VALUE_TICK_SPACING = 80;
/* The line of the values under a horizontal plot, and the room a rule label takes above it. */
const VALUE_AXIS_LINE = 16;
const RULE_LABEL_ROOM = 20;
const NO_ENTRIES = new Map<string, never>();

const defaultValue = (value: number): string => (Number.isInteger(value) ? formatNumber(value) : formatRounded(value, 2));

/* The box of a chart: owns the data, the scales, the cursor and the keyboard; each part inside draws one layer. */
export function ChartRoot<Row>({
    data,
    x,
    xScale = 'band',
    rows = 'buckets',
    rowKey,
    rowLabel,
    format,
    xOptions,
    step: stepProp,
    yScale = 'linear',
    y = {},
    label,
    orientation = 'vertical',
    rowHeight = ROW_HEIGHT,
    height: leastHeight = 200,
    grow = false,
    margin = {},
    surface = 'base',
    activeX,
    onActiveXChange,
    group,
    groupLabel,
    groupGap = GROUP_GAP,
    minBucketWidth = 0,
    selected,
    interactive = true,
    cursor = 'full',
    onActivate,
    dimmed,
    children,
    className,
    ref
}: ChartRootProps<Row>) {
    const { t } = useTranslation('charts');
    const id = useId();
    const [store] = useState(createChartStore);
    const allSeries = useSyncExternalStore(store.subscribe, store.series, store.series);
    const axes = useSyncExternalStore(store.subscribe, store.axes, store.axes);
    const xAxes = useSyncExternalStore(store.subscribe, store.xAxes, store.xAxes);
    const yAxes = useSyncExternalStore(store.subscribe, store.yAxes, store.yAxes);
    const allMarkers = useSyncExternalStore(store.subscribe, store.markers, store.markers);
    const allBands = useSyncExternalStore(store.subscribe, store.bands, store.bands);
    const rules = useSyncExternalStore(store.subscribe, store.rules, store.rules);
    const formats = useSyncExternalStore(store.subscribe, store.formats, store.formats);
    const chartGroup = useContext(GroupContext);
    const sharedCursor = chartGroup?.cursor ?? null;
    const [ownX, setOwnX] = useState<ChartX | null>(null);
    // Where the keyboard left the cursor, which it returns to when the pointer passes over and leaves again.
    const [keyX, setKeyX] = useState<ChartX | null>(null);
    const [legendSlot, setLegendSlot] = useState<HTMLElement | null>(null);
    const [tableSlot, setTableSlot] = useState<HTMLElement | null>(null);
    const [tooltipSlot, setTooltipSlot] = useState<HTMLElement | null>(null);
    const [groupsSlot, setGroupsSlot] = useState<HTMLElement | null>(null);
    const [leftSlot, setLeftSlot] = useState<SVGGElement | null>(null);
    const [rightSlot, setRightSlot] = useState<SVGGElement | null>(null);
    const [rulesSlot, setRulesSlot] = useState<SVGGElement | null>(null);
    const [rowsSlot, setRowsSlot] = useState<HTMLElement | null>(null);
    const [scroll, setScroll] = useState(0);
    const [announce, setAnnounce] = useState(false);
    const [measure, size] = useContentSize();
    const [measureGroups, groupsSize] = useContentSize();
    // The row of group labels under the plot takes its share of the height a growing chart is given.
    const boxHeight = grow ? Math.max(leastHeight, size.height - groupsSize.height) : leastHeight;
    const scroller = useRef<HTMLDivElement>(null);

    const points = rows === 'points';
    const band = xScale === 'band' && !points;
    const horizontal = orientation === 'horizontal' && band;
    // Only columns turn into rows; a line, a point, a marker or a band across rows would read nothing a bar does not.
    const series = horizontal ? new Map([...allSeries].filter(([, entry]) => entry.kind === 'bar')) : allSeries;
    const markers = horizontal ? NO_ENTRIES : allMarkers;
    const bands = horizontal ? NO_ENTRIES : allBands;
    const dropped = horizontal && (series.size < allSeries.size || allMarkers.size > 0 || allBands.size > 0);

    useEffect(() => {
        if (orientation === 'horizontal' && !band) {
            warnOnce('Chart.Root: `orientation="horizontal"` takes the buckets of a band scale; this chart stays vertical.');
        }

        if (dropped) {
            warnOnce('Chart.Root: a horizontal chart draws `Chart.Bar` only; its lines, areas, points, markers and bands are left out.');
        }
    }, [orientation, band, dropped]);

    // The compiler leaves these maps uncached; cursor updates must reuse unchanged data.
    const { xs, keys, rowLabels, groupKeys, groupLabels } = useMemo(() => {
        const xs = data.map((row, index) => {
            const value = readValue(x, row, index);

            return value === null || value === undefined ? Number.NaN : xOf(value);
        });

        const keys = points ? data.map((row, index) => (rowKey === undefined ? String(index) : String(readValue(rowKey, row, index)))) : null;
        const rowLabels = rowLabel !== undefined ? data.map((row, index) => String(readValue(rowLabel, row, index))) : null;
        const groupKeys = (band || points) && group !== undefined ? data.map((row, index) => String(readValue(group, row, index))) : null;
        const groupLabels =
            groupKeys === null ? null : groupLabel === undefined ? groupKeys : data.map((row, index) => String(readValue(groupLabel, row, index)));

        return { xs, keys, rowLabels, groupKeys, groupLabels };
    }, [data, x, points, rowKey, rowLabel, band, group, groupLabel]);
    const leftY = yAxes.get('left');
    const rightY = yAxes.get('right');
    // A horizontal chart has no y axis beside it: the names of its rows take that place, and its values run underneath.
    const [leftAxis, rightAxis] = useAlignedAxes(
        chartGroup?.widths ?? null,
        horizontal ? (axes.start ?? 0) : (leftY?.width ?? 0),
        horizontal ? 0 : (rightY?.width ?? 0)
    );

    const room = Math.max(0, size.width - leftAxis - rightAxis);
    // A bucket of a time scale runs from its x for one step and its point stands in the middle, as a column would.
    const bucketStep = xScale === 'time' && !points ? (stepProp ?? bucketStepOf(xs as number[])) : 0;
    const inset = band || bucketStep > 0 ? 0 : INSET;
    const marginLeft = margin.left ?? inset;
    const marginRight = margin.right ?? inset;

    // Band geometry has no cursor input, but the compiler leaves this call uncached.
    const layout = useMemo(
        () =>
            horizontal
                ? bandLayout(xs.length, groupKeys, 0, rowHeight, groupGap)
                : band
                  ? bandLayout(xs.length, groupKeys, Math.max(0, room - marginLeft - marginRight), minBucketWidth, groupGap)
                  : null,
        [horizontal, band, xs.length, groupKeys, rowHeight, groupGap, room, marginLeft, marginRight, minBucketWidth]
    );
    const width = layout === null || horizontal ? room : Math.max(room, Math.ceil(layout.width + marginLeft + marginRight));
    const scrolls = layout !== null && width > room;
    // A scrolling plot clips what hangs out of its first buckets, such as a value label or a slanted name, so the
    // scroller reaches over the y axis by its width and gives that back as padding: the plot stays where it was.
    const overhang = scrolls ? leftAxis : 0;
    const xRows = [...xAxes.values()];
    const valueRoom = horizontal ? Math.max(0, ...[...series.values()].map((entry) => entry.endRoom ?? 0)) : 0;
    const titleRoom = leftY?.top ?? rightY?.top ?? 0;
    let top: number;
    let bottom: number;
    let height: number;

    if (horizontal) {
        top = Math.max(margin.top ?? 8, titleRoom + (rules.size > 0 ? RULE_LABEL_ROOM : 0));
        // Without rows the plot keeps the room of two, where it says there is no data.
        bottom = top + (xs.length === 0 ? 2 * rowHeight : layout!.width);
        height = bottom + (margin.bottom ?? 0) + (yAxes.size > 0 ? X_AXIS_GAP + VALUE_AXIS_LINE : 0);
    } else {
        height = boxHeight;
        bottom = height - (xRows.length === 0 ? (margin.bottom ?? 0) : (margin.bottom ?? 4) + X_AXIS_GAP + xRows.reduce((sum, row) => sum + row.room, 0));
        top = Math.max(margin.top ?? 8, leftY?.top ?? 0, rightY?.top ?? 0, [...series.values()].some((entry) => entry.valueLabels) ? VALUE_LABEL_ROOM : 0);
    }

    const right = width - marginRight - (axes.end ?? 0) - valueRoom;
    const plot = { left: marginLeft, top, right, bottom, width: Math.max(0, right - marginLeft), height: Math.max(0, bottom - top) };
    const valueRange: [number, number] = horizontal ? [plot.left, plot.right] : [plot.bottom, plot.top];
    const continuousKind = xScale === 'band' ? 'linear' : xScale;

    const continuous = band
        ? null
        : points
          ? pointXScale(continuousKind, xs as number[], [plot.left, plot.right], xOptions)
          : continuousXScale(continuousKind, xs as number[], [plot.left, plot.right], bucketStep, xOptions);

    const stackInput = [...series].map(([seriesId, entry]) => ({ id: seriesId, values: entry.values, stack: entry.stack }));
    const stacked = stackSeries(stackInput, xs.length);
    // A reference line stays on the plot, also where the data does not reach it.
    const ruleValues = [...rules.values()].map((rule) => rule.value);
    const yOptions = ruleValues.length === 0 ? y : { ...y, include: [...(y.include ?? []), ...ruleValues] };

    const scaleY = yScaleOf(
        yScale,
        extentOf(stacked.values(), yScale, !points),
        yOptions,
        valueRange,
        leftY?.ticks ?? rightY?.ticks ?? (horizontal ? tickCount(plot.width, VALUE_TICK_SPACING) : tickCount(plot.height, Y_TICK_SPACING)),
        !points
    );

    const yStep = scaleY.ticks.length > 1 ? scaleY.ticks[1]! - scaleY.ticks[0]! : 1;

    // A value past `y.max` or `y.min` stops at the edge of the plot, which the svg does not clip.
    const pixelOfY = (value: number): number | null => {
        const pixel = scaleY.at(value);

        return pixel === null ? null : Math.min(Math.max(...valueRange), Math.max(Math.min(...valueRange), pixel));
    };

    const colors = new Map<string, string>();
    let next = 0;

    for (const [seriesId, entry] of series) {
        colors.set(seriesId, entry.color ?? seriesColor(next++));
    }

    const slots = new Map<string, { slot: number; count: number }>();
    const members = new Map<string, string[]>();

    for (const [seriesId, entry] of series) {
        if (entry.kind === 'bar') {
            const ids = members.get(entry.bars ?? '');

            if (ids === undefined) {
                members.set(entry.bars ?? '', [seriesId]);
            } else {
                ids.push(seriesId);
            }
        }
    }

    for (const ids of members.values()) {
        const stackedBars = ids.some((seriesId) => series.get(seriesId)!.stack !== null);
        ids.forEach((seriesId, index) => slots.set(seriesId, stackedBars ? { slot: 0, count: 1 } : { slot: index, count: ids.length }));
    }

    // A point chart places a row at its x and the value of its first point or line, and puts the rows in series by group.
    const placing = points ? [...series.values()].find((entry) => entry.kind === 'point' || entry.kind === 'line') : undefined;
    const pointGroups: { key: string; indexes: number[] }[] = [];
    const groupIndexes: number[] = [];

    if (points) {
        const found = new Map<string, number>();

        data.forEach((_, index) => {
            const key = groupKeys?.[index] ?? '';
            let at = found.get(key);

            if (at === undefined) {
                at = pointGroups.length;
                found.set(key, at);
                pointGroups.push({ key, indexes: [] });
            }

            pointGroups[at]!.indexes.push(index);
            groupIndexes.push(at);
        });
    }

    const placed: PlacedPoint[] = [];

    const positions: ([number, number] | null)[] = data.map((_, index) => {
        const value = placing?.values[index];
        const left = continuous === null || !points ? Number.NaN : continuous.at(xs[index] as number);
        const pixel = value === null || value === undefined ? null : pixelOfY(value);

        if (pixel === null || !Number.isFinite(left)) {
            return null;
        }

        placed.push({ index, x: left, y: pixel });

        return [left, pixel];
    });

    // A point and the line through it often read the same value, which a person hears once.
    const readable = [...series].filter(([, entry], index, all) => !points || all.findIndex(([, other]) => other.label === entry.label) === index);

    const groupColorOf = (index: number): string => seriesColor(groupIndexes[index] ?? 0);

    const pointColor = (index: number): string => placing?.rowColors?.[index] ?? placing?.color ?? groupColorOf(index);

    const bucketStart = horizontal ? plot.top : plot.left;

    const centerOf = (index: number): number => {
        if (layout !== null) {
            return bucketStart + (layout.lefts[index] ?? 0) + layout.bucket / 2;
        }

        return continuous!.at((xs[index] as number) + bucketStep / 2);
    };

    const bucketAt = (index: number): { left: number; width: number } | null => {
        if (layout !== null) {
            return { left: bucketStart + (layout.lefts[index] ?? 0), width: layout.bucket };
        }

        if (bucketStep <= 0 || xs[index] === undefined) {
            return null;
        }

        const left = continuous!.at(xs[index] as number);

        return { left, width: continuous!.at((xs[index] as number) + bucketStep) - left };
    };

    const pixelOfX = (value: ChartX): number | null => {
        if (layout !== null) {
            const index = keyIndexOf(xs, value);

            return index < 0 ? null : centerOf(index);
        }

        return typeof value === 'number' ? continuous!.at(value) : null;
    };

    const span = continuous === null ? 0 : continuous.domain[1] - continuous.domain[0];
    // A row under another names something wider, such as the model under its effort, so a bucket reads from the bottom row up.
    const rowFormats = xRows.flatMap((row) => (row.format === undefined ? [] : [row.format])).toReversed();

    const formatX = (value: ChartX): string => {
        if (rowFormats.length > 0) {
            return rowFormats.map((format) => format(value)).join(', ');
        }

        if (xScale === 'time' && typeof value === 'number') {
            return formatTime(value, timeLabelOf(span, bucketStep));
        }

        return typeof value === 'number' ? defaultValue(value) : value;
    };

    // Both axes share one scale, so the tooltip, the live region and the table write a value as the left one does.
    const formatY = format ?? leftY?.format ?? rightY?.format ?? defaultValue;

    /* The x of a point with the title of its axis, as a person reads it out: "Cost per task $0.12". */
    const xValueOf = (index: number): string => {
        const text = formatX(xs[index]!);

        return points && formats.xTitle !== undefined ? `${formats.xTitle} ${text}` : text;
    };

    const notesAt = (index: number): ChartNote[] => {
        const at = xs[index];

        if (at === undefined) {
            return [];
        }

        const notes: ChartNote[] = [];

        for (const marker of markers.values()) {
            // The points of a chart stand in no order, so a moment belongs to none of them.
            const inside = band
                ? String(marker.at) === String(at)
                : !points && typeof marker.at === 'number' && containingIndex(xs as number[], marker.at, bucketStep || undefined) === index;

            if (inside) {
                notes.push({ kind: 'marker', label: marker.label, detail: marker.detail, color: marker.color });
            }
        }

        for (const range of bands.values()) {
            let inside: boolean;

            if (band) {
                const from = keyIndexOf(xs, range.from);
                const to = keyIndexOf(xs, range.to);
                inside = from >= 0 && to >= 0 && index >= Math.min(from, to) && index <= Math.max(from, to);
            } else if (bucketStep > 0) {
                inside = (at as number) < (range.to as number) && (at as number) + bucketStep > (range.from as number);
            } else {
                inside = (at as number) >= (range.from as number) && (at as number) < (range.to as number);
            }

            if (inside) {
                notes.push({ kind: 'band', label: range.label, detail: range.detail, color: range.color });
            }
        }

        return notes;
    };

    const controlled = activeX !== undefined;
    const cursorX = controlled ? activeX : sharedCursor !== null ? sharedCursor.x : ownX;

    const indexAt = (value: ChartX | null): number => {
        if (keys === null) {
            return snapIndex(xs, xScale, value, bucketStep);
        }

        const index = value === null ? -1 : keys.indexOf(String(value));

        return positions[index] == null ? -1 : index;
    };

    const activeIndex = indexAt(cursorX);
    const keyIndex = indexAt(keyX);
    const from = keyIndex >= 0 ? keyIndex : activeIndex;
    const ownsCursor = controlled || sharedCursor === null || sharedCursor.owner === id;

    const setActiveX = (value: ChartX | null): void => {
        if (!controlled) {
            if (sharedCursor !== null) {
                sharedCursor.setX(value, id);
            } else {
                setOwnX(value);
            }
        }

        onActiveXChange?.(value);
    };

    const picked = new Set((selected ?? []).map(String));
    const selectedRows = (keys ?? xs).map((key) => picked.has(String(key)));
    const dimmedRows = data.map((row, index) => dimmed?.(row, index) ?? false);
    const dimmedGroups = new Set(pointGroups.filter((run) => run.indexes.every((index) => dimmedRows[index])).map((run) => run.key));
    // A label under a column follows it: dimmed with it, and stronger while it is under the cursor or picked.
    const anyPicked = selectedRows.some(Boolean);
    const columnDim = [...series.values()].find((entry) => entry.kind === 'bar')?.dimOpacity ?? null;

    const labelFocus = xs.map((_, index): 'strong' | 'dim' | null => {
        if (index === activeIndex || selectedRows[index]) {
            return 'strong';
        }

        return dimmedRows[index] || anyPicked ? 'dim' : null;
    });

    const describe = (index: number): string => {
        const parts = (
            points ? [groupLabels?.[index], rowLabels?.[index], xValueOf(index)] : [groupLabels?.[index], rowLabels?.[index] ?? xValueOf(index)]
        ).filter((part): part is string => part !== undefined);

        for (const [, entry] of readable) {
            const value = entry.values[index];

            if (value !== null && value !== undefined) {
                parts.push(`${entry.label} ${formatY(value)}`);
            }
        }

        return [...parts, ...notesAt(index).map((note) => (note.detail === null ? note.label : `${note.label}, ${note.detail}`))].join(', ');
    };

    useEffect(() => {
        warnMissingKey(x, data, 'Chart.Root');
    }, [x, data]);

    const indexAtPointer = (e: MouseEvent<Element>): number => {
        const box = e.currentTarget.getBoundingClientRect();
        const pixel = horizontal ? e.clientY - box.top : e.clientX - box.left;

        if (points) {
            return nearestPoint(placed, pixel, e.clientY - box.top, POINT_REACH);
        }

        return nearestIndex(
            xs.map((_, index) => centerOf(index)),
            pixel
        );
    };

    const onPointerMove = (e: PointerEvent<Element>): void => {
        setAnnounce(false);

        if (xs.length === 0) {
            return;
        }

        if (keys !== null) {
            const index = indexAtPointer(e);

            if (index !== activeIndex) {
                setActiveX(index < 0 ? null : keys[index]!);
            }

            return;
        }

        if (continuous !== null) {
            const pixel = e.clientX - e.currentTarget.getBoundingClientRect().left;
            // The end of the last bucket is the start of none, so the pointer stops a pixel short of it.
            const index = snapIndex(xs, xScale, continuous.invert(Math.min(plot.right - 1, Math.max(plot.left, pixel))), bucketStep);
            const value = index < 0 ? null : xs[index]!;

            if (value !== cursorX) {
                setActiveX(value);
            }

            return;
        }

        const index = indexAtPointer(e);

        if (index >= 0 && String(xs[index]) !== String(cursorX)) {
            setActiveX(xs[index]!);
        }
    };

    const pressable = interactive && onActivate !== undefined && (layout !== null || points);

    const activate = (index: number): void => {
        if (pressable && index >= 0) {
            onActivate(data[index]!, index);
        }
    };

    const onKeyDown = (e: KeyboardEvent<SVGSVGElement>): void => {
        if (pressable && from >= 0 && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            activate(from);

            return;
        }

        const groupStarts = layout?.groups.map((run) => run.first) ?? [];

        const target =
            keys === null
                ? moveIndex(e.key, from, xs.length, groupStarts, horizontal ? 'rows' : 'columns')
                : movePoint(
                      pointGroups.map((run) => run.indexes.filter((index) => positions[index] !== null)),
                      from,
                      e.key
                  );

        if (target === undefined) {
            return;
        }

        e.preventDefault();

        if (target === null) {
            // A dialog around the chart closes on an Escape that reaches the document, whether or not it was prevented.
            e.stopPropagation();
            setKeyX(null);
            setActiveX(null);

            return;
        }

        setAnnounce(true);
        const value = keys === null ? xs[target]! : keys[target]!;
        setKeyX(value);
        setActiveX(value);
        const box = scroller.current;

        if (box !== null && box.scrollWidth > box.clientWidth) {
            const center = centerOf(target);
            const visible = box.clientWidth - overhang;

            if (center < box.scrollLeft || center > box.scrollLeft + visible) {
                box.scrollLeft = Math.max(0, center - visible / 2);
            }
        }
    };

    const context: ChartContextValue = {
        store,
        label,
        data,
        xs,
        xScale,
        height,
        plot,
        width,
        band: layout,
        continuous,
        horizontal,
        valueRoom,
        y: scaleY,
        yStep,
        series,
        stacked,
        colors,
        slots,
        markers,
        bands,
        groupKeys,
        groupLabels,
        activeIndex,
        ownsCursor,
        selected: selectedRows,
        dimmed: dimmedRows,
        labelFocus,
        labelDim: columnDim ?? 0.4,
        elements: {
            legend: legendSlot,
            table: tableSlot,
            tooltip: tooltipSlot,
            groups: groupsSlot,
            left: leftSlot,
            right: rightSlot,
            rules: rulesSlot,
            rows: rowsSlot
        },
        scroll,
        box: size.width,
        leftAxis,
        rightAxis,
        centerOf,
        bucketAt,
        pixelOfX,
        pixelOfY,
        setActiveX,
        formatX,
        formatY,
        valueFormat: format ?? null,
        notesAt,
        points,
        keys,
        rowLabels,
        positions,
        pointGroups,
        dimmedGroups,
        groupColorOf,
        pointColor,
        xValueOf,
        xTitle: formats.xTitle ?? null,
        readable,
        byKeyboard: announce,
        keyIndex,
        halo: surface === 'raised' ? 'var(--surface-raised)' : 'var(--surface)'
    };

    // A reference line holds for every bucket, so a screen reader hears it once with the chart instead of in every bucket.
    const ruleText = rules.size === 0 ? null : `${[...rules.values()].map((rule) => `${rule.label} ${formatY(rule.value)}`).join(', ')}.`;

    const hint = [
        ruleText,
        points ? t('keyboard.points') : horizontal ? t('keyboard.rows') : t('keyboard.move'),
        layout !== null && layout.groups.length > 0 ? t('keyboard.groups') : null,
        pressable ? t('keyboard.activate') : null
    ]
        .filter(Boolean)
        .join(' ');

    const highlighted = layout === null ? [] : xs.flatMap((_, index) => ((cursor === 'full' && index === activeIndex) || selectedRows[index] ? [index] : []));

    // A bucket across the plot, where the cursor lights it; pressable, it also reaches over what is written beside it.
    const bucketBox = (index: number, pressing: boolean): { x: number; y: number; width: number; height: number } => {
        const start = Math.round(bucketStart + (layout?.lefts[index] ?? 0));
        const size = Math.max(1, Math.round(layout?.bucket ?? 0));

        if (horizontal) {
            return pressing
                ? { x: 0, y: start, width, height: size }
                : { x: plot.left, y: start, width: Math.max(0, plot.right + valueRoom - plot.left), height: size };
        }

        return { x: start, y: plot.top, width: size, height: pressing ? height - plot.top : plot.height };
    };

    // The names of the rows stand beside the plot, and a person points at a name as much as at its bar.
    const pointer = {
        onPointerMove,
        onPointerLeave: () => setActiveX(keyX),
        onClick: pressable ? (e: MouseEvent<Element>) => activate(indexAtPointer(e)) : undefined
    };

    return (
        <ChartContext value={context}>
            <div ref={ref} className={clsx('flex min-w-0 flex-col gap-3', grow && 'h-full min-h-0', className)}>
                <div ref={setLegendSlot} className="empty:hidden" />
                {/* The ring stands outside the box, where it clears the labels at the edges of the axes. */}
                <div
                    ref={measure}
                    className={clsx(
                        'focus-ring-within relative flex rounded-md',
                        grow && !horizontal && 'min-h-0 flex-1',
                        horizontal && pressable && 'cursor-pointer'
                    )}
                    style={{ outlineOffset: 4 }}
                    {...(horizontal ? pointer : {})}
                >
                    {horizontal ? (
                        <div ref={setRowsSlot} aria-hidden className="relative shrink-0" style={{ width: leftAxis, height }} />
                    ) : (
                        <svg width={leftAxis} height={height} aria-hidden className="shrink-0 overflow-visible">
                            <g ref={setLeftSlot} tabIndex={-1} />
                        </svg>
                    )}
                    <div
                        ref={scroller}
                        className={clsx('min-w-0 flex-1', scrolls ? 'overflow-x-auto overflow-y-hidden overscroll-x-contain' : 'overflow-visible')}
                        style={
                            overhang > 0
                                ? {
                                      marginLeft: -overhang,
                                      paddingLeft: overhang,
                                      // Scrolled, the columns would pass over the y axis labels; only the start may hang there.
                                      clipPath: scroll > 0 ? `inset(0 0 0 ${overhang}px)` : undefined
                                  }
                                : undefined
                        }
                        onScroll={(e) => setScroll(e.currentTarget.scrollLeft)}
                    >
                        <svg
                            width={width}
                            height={height}
                            role={interactive ? 'group' : 'img'}
                            tabIndex={interactive ? 0 : undefined}
                            aria-roledescription={interactive ? t('chart') : undefined}
                            aria-label={label}
                            aria-describedby={interactive ? `${id}-hint` : undefined}
                            aria-activedescendant={pressable && from >= 0 ? `${id}-${from}` : undefined}
                            className={clsx('block overflow-visible outline-none', pressable && 'cursor-pointer')}
                            {...(horizontal ? {} : pointer)}
                            onKeyDown={interactive ? onKeyDown : undefined}
                            onBlur={() => {
                                setAnnounce(false);
                                setKeyX(null);

                                // A bucket the keyboard left, or any point, keeps no preview open where the focus went on.
                                if (activeIndex >= 0 && (points || announce)) {
                                    setActiveX(null);
                                }
                            }}
                        >
                            {layout !== null && highlighted.map((index) => <rect key={index} {...bucketBox(index, false)} className="fill-surface-hover" />)}
                            {children}
                            <g ref={setRulesSlot} tabIndex={-1} />
                            {continuous !== null && !points && activeIndex >= 0 && cursor !== 'none' && (
                                <Crosshair context={context} dots={cursor === 'full'} />
                            )}
                            {points && <Guides context={context} />}
                            {pressable &&
                                points &&
                                positions.map((position, index) =>
                                    position === null ? null : (
                                        <circle
                                            key={keys![index]}
                                            id={`${id}-${index}`}
                                            role="button"
                                            aria-pressed={selectedRows[index]}
                                            aria-label={describe(index)}
                                            cx={position[0]}
                                            cy={position[1]}
                                            r={10}
                                            fill="transparent"
                                        />
                                    )
                                )}
                            {pressable &&
                                layout !== null &&
                                xs.map((key, index) => (
                                    <rect
                                        key={String(key)}
                                        id={`${id}-${index}`}
                                        role="button"
                                        aria-pressed={selectedRows[index]}
                                        aria-label={describe(index)}
                                        {...bucketBox(index, true)}
                                        fill="transparent"
                                    />
                                ))}
                            {xs.length === 0 && (
                                <text
                                    x={Math.round((plot.left + plot.right) / 2)}
                                    y={Math.round((plot.top + plot.bottom) / 2)}
                                    dy="0.32em"
                                    textAnchor="middle"
                                    className="fill-text-faint text-xs"
                                >
                                    {t('noData')}
                                </text>
                            )}
                        </svg>
                        <div
                            ref={(node) => {
                                setGroupsSlot(node);
                                measureGroups(node);
                            }}
                            className="empty:hidden"
                            style={{ width }}
                        />
                    </div>
                    <svg width={rightAxis} height={height} aria-hidden className="shrink-0 overflow-visible">
                        <g ref={setRightSlot} tabIndex={-1} />
                    </svg>
                    <div ref={setTooltipSlot} className="pointer-events-none absolute inset-0" />
                </div>
                <div ref={setTableSlot} className="empty:hidden" />
                {interactive && (
                    <>
                        <p id={`${id}-hint`} className="sr-only">
                            {hint}
                        </p>
                        <p aria-live="polite" className="sr-only">
                            {/* A pressable bucket is read through its button as the active descendant; the live region would say it twice. */}
                            {announce && activeIndex >= 0 && !pressable ? describe(activeIndex) : ''}
                        </p>
                    </>
                )}
            </div>
        </ChartContext>
    );
}

/* The line at the cursor and a dot where it crosses each line and area. */
function Crosshair({ context, dots }: { context: ChartContextValue; dots: boolean }) {
    const { activeIndex, centerOf, plot, series, stacked, colors, pixelOfY } = context;
    const left = Math.round(centerOf(activeIndex)) + 0.5;

    return (
        <g className="pointer-events-none">
            <line x1={left} x2={left} y1={plot.top} y2={plot.bottom} className="stroke-border-strong" />
            {[...series].map(([seriesId, entry]) => {
                const top = stacked.get(seriesId)?.top[activeIndex];
                const pixel = !dots || top === null || top === undefined || entry.kind === 'bar' ? null : pixelOfY(top);

                return pixel === null ? null : (
                    <circle
                        key={seriesId}
                        cx={left}
                        cy={Math.round(pixel)}
                        r={4}
                        strokeWidth={2}
                        style={{ fill: colors.get(seriesId), stroke: context.halo }}
                    />
                );
            })}
        </g>
    );
}

/* Halo text over the axis, which covers the tick label under it. */
const HALO = { strokeWidth: 4, strokeLinejoin: 'round', paintOrder: 'stroke' } as const;

/* Dashed guides from the point under the cursor and every picked point to both axes, with their values on the axes. */
function Guides({ context }: { context: ChartContextValue }) {
    const { activeIndex, positions, selected, plot, xs, formatX, formatY, series, data } = context;

    const shown = [...new Set([activeIndex, ...selected.flatMap((picked, index) => (picked ? [index] : []))])].filter(
        (index) => index >= 0 && positions[index] != null
    );

    const placing = [...series.values()].find((entry) => entry.kind === 'point' || entry.kind === 'line');

    if (shown.length === 0 || placing === undefined || data.length === 0) {
        return null;
    }

    return (
        <g className="pointer-events-none" aria-hidden>
            {shown.map((index) => {
                const [left, top] = positions[index]!;
                const x = Math.round(left);
                const y = Math.round(top);

                return (
                    <g key={index}>
                        <path d={`M${plot.left} ${y + 0.5} H${x + 0.5} V${plot.bottom}`} fill="none" className="stroke-text-muted" strokeDasharray="4 4" />
                        <text
                            x={x}
                            y={plot.bottom + X_AXIS_GAP}
                            dy="0.8em"
                            textAnchor="middle"
                            className="fill-text text-xs tabular-nums"
                            style={{ stroke: context.halo }}
                            {...HALO}
                        >
                            {formatX(xs[index]!)}
                        </text>
                        <text
                            x={-X_AXIS_GAP}
                            y={y}
                            dy="0.32em"
                            textAnchor="end"
                            className="fill-text text-xs tabular-nums"
                            style={{ stroke: context.halo }}
                            {...HALO}
                        >
                            {formatY(placing.values[index]!)}
                        </text>
                    </g>
                );
            })}
        </g>
    );
}
