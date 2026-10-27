import { useContext, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import type { IconProps } from '@adecore/ui';
import { area, curveLinear, curveMonotoneX, curveStepAfter, line } from 'd3-shape';
import { numberOf, readValue, warnOnce } from './access.ts';
import { columnsIn, endRoundedBar, endRoundedColumn, guessLabelWidth, LABEL_INSET, LABEL_LIFT, placeValueLabels, segmentOf } from './band.ts';
import { colorOf, seriesColor } from './color.ts';
import { BarsContext, useChartContext, type ChartContextValue } from './context.ts';
import { useBeforePaint, useKeyCheck, useRegistration } from './register.ts';
import type { ChartAccessor, ChartColor, ChartCurve } from './types.ts';

export interface ChartLineProps<Row> {
    readonly value: ChartAccessor<Row, number | null | undefined>;
    /* The name of the series in the tooltip, the legend and the table. */
    readonly label: string;
    /* On a point chart also a function of the row, which colors each series by its first row. */
    readonly tone?: ChartBarTone<Row>;
    /* Stands in the color of the series in place of its swatch, in the legend and the tooltip. */
    readonly icon?: IconProps['icon'];
    readonly curve?: ChartCurve;
    readonly dashed?: boolean;
    /* A dot on every value. Without it only a value with no neighbor gets one, so it does not vanish. */
    readonly dots?: boolean;
    /* The thickness of the line in pixels; 1 for a small chart beside others. */
    readonly width?: 1 | 2;
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

export interface ChartAreaProps<Row> extends Omit<ChartLineProps<Row>, 'tone' | 'width'> {
    readonly tone?: ChartColor;
    /* Piles the area on the stacked areas before it instead of on zero. */
    readonly stack?: boolean;
    /* The line along its top in pixels; 0 draws the area alone. */
    readonly width?: 0 | 1 | 2;
    /* A gradient that fades toward the ground, or one flat tint, as a stacked area always has. */
    readonly fill?: 'gradient' | 'flat';
}

export interface ChartPointProps<Row> {
    readonly value: ChartAccessor<Row, number | null | undefined>;
    readonly label: string;
    /* A tone, a color of the app's own, or either per row; on a point chart each series takes the next chart color without one. */
    readonly tone?: ChartBarTone<Row>;
    readonly icon?: IconProps['icon'];
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

/* A tone, a color of the app's own, or either per row: `(row) => runTone(row.status)`. */
export type ChartBarTone<Row> = ChartColor | ((row: Row, index: number) => ChartColor);

export interface ChartBarProps<Row> {
    readonly value: ChartAccessor<Row, number | null | undefined>;
    readonly label: string;
    readonly tone?: ChartBarTone<Row>;
    readonly icon?: IconProps['icon'];
    /* The opacity of a column by its place in its group, for columns that grow stronger inside one. */
    readonly opacity?: (row: Row, indexInGroup: number, groupSize: number) => number;
    /* The opacity of the other columns while the cursor is on a bucket; 1 leaves them as they are. */
    readonly hoverOpacity?: number;
    /* The opacity of a column the root dims, or that is not picked while another is. */
    readonly dimOpacity?: number;
    /*
     * The pixels the columns of a bucket take together, from the width of the bucket; 72% of it by default, at most 56px a
     * column. In a horizontal chart the bucket is a row and this is the thickness of its bars.
     */
    readonly columnWidth?: (bucket: number) => number;
    /* The corner radius of a column that stands alone; stacked segments stay square. */
    readonly radius?: number;
    /* `end` rounds only the end away from the ground, so the column stands flat on it. */
    readonly rounded?: 'all' | 'end';
    /* The least height of a column that stands alone, in pixels, also for a zero; a missing value still draws nothing. The least length of a bar. */
    readonly minHeight?: number;
    /*
     * Writes each column's value over it, as the y axis writes it or through the function; labels that would collide move
     * up a row. In a horizontal chart the value stands past the end of the bar, and a stack writes its total past its end.
     */
    readonly valueLabels?: boolean | ((value: number, row: Row, index: number) => string);
    /* The columns grow from the ground when they first draw; not for a person who asks for reduced motion. */
    readonly animate?: boolean;
    /* The type size of the value labels: `2xs` beside a dense row of columns, `xs` over a few wide ones and beside rows (the default there). */
    readonly valueLabelSize?: '2xs' | 'xs';
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

export interface ChartBarsProps {
    /* Piles the columns of a bucket on each other instead of standing them side by side. */
    readonly stack?: boolean;
    readonly children?: ReactNode;
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

const CURVES = { linear: curveLinear, monotone: curveMonotoneX, step: curveStepAfter };

/* Columns outside the bucket under the cursor still read as their own color at this. */
const HOVER_DIM = 0.55;
/* At 0.3, times the opacity a column has in its group, a dimmed column nearly vanishes in the dark theme. */
const OUT_OF_FOCUS = 0.4;
/* A dimmed point or series of a point chart; its full color keeps it readable lower than a light column. */
export const DIMMED_POINT = 0.25;
/* A flat area, also one stacked on another, where the line over it still stands out. */
const FLAT_FILL = 0.28;

type Point = readonly [number, number] | null;

const pointsOf = (chart: ChartContextValue, values: readonly (number | null)[]): Point[] =>
    values.map((value, index) => {
        const pixel = value === null ? null : chart.pixelOfY(value);

        return pixel === null ? null : [chart.centerOf(index), pixel];
    });

/* The pixel of zero, or of the lowest value when the axis starts above it. */
const groundOf = (chart: ChartContextValue): number => chart.pixelOfY(Math.max(chart.y.domain[0], 0)) ?? chart.plot.bottom;

/* A value between two gaps is no line at all, so it gets a dot of its own. */
const lonePoints = (points: readonly Point[]): number[] =>
    points.flatMap((point, index) => (point !== null && points[index - 1] == null && points[index + 1] == null ? [index] : []));

function useSeriesValues<Row>(part: string, value: ChartAccessor<Row, number | null | undefined>): [ChartContextValue, string, (number | null)[]] {
    const chart = useChartContext(part);
    const id = useId();
    useKeyCheck(value, chart.data, part);

    return [chart, id, (chart.data as Row[]).map((row, index) => numberOf(readValue(value, row, index)))];
}

function LinePath({
    points,
    curve,
    dashed,
    dots,
    width = 2
}: {
    points: readonly Point[];
    curve: ChartCurve;
    dashed: boolean;
    dots: boolean;
    width?: 0 | 1 | 2;
}) {
    if (width === 0) {
        return null;
    }

    const path = line<Point>()
        .defined((point) => point !== null)
        .x((point) => point![0])
        .y((point) => point![1])
        .curve(CURVES[curve])(points);

    // Keyed by index: before the chart is measured every point stands at the same x.
    const marked = dots ? points.flatMap((point, index) => (point === null ? [] : [index])) : lonePoints(points);

    return (
        <>
            {path !== null && (
                <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={width}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={dashed ? '4 4' : undefined}
                />
            )}
            {marked.map((index) => (
                <circle key={index} cx={points[index]![0]} cy={points[index]![1]} r={2.5} fill="currentColor" />
            ))}
        </>
    );
}

/* The colors of a series per row when its tone is a function of the row, and its one color otherwise. */
function tonesOf<Row>(chart: ChartContextValue, tone: ChartBarTone<Row> | undefined): [string | null, string[] | null] {
    const rows = chart.data as Row[];
    const rowColors = typeof tone === 'function' ? rows.map((row, index) => colorOf(tone(row, index))!) : null;

    return [typeof tone === 'function' ? (rowColors?.[0] ?? null) : colorOf(tone), rowColors];
}

/* A line through the values. A missing value breaks it. On a point chart a line per series, through its points in the order of the data. */
export function ChartLine<Row>({ value, label, tone, icon, curve = 'linear', dashed = false, dots = false, width = 2, className, ref }: ChartLineProps<Row>) {
    const [chart, id, values] = useSeriesValues('Chart.Line', value);
    const [color, rowColors] = tonesOf(chart, tone);

    useRegistration(chart.store, 'series', id, {
        kind: 'line',
        label,
        color,
        rowColors,
        values,
        stack: null,
        bars: null,
        curve,
        icon: icon ?? null,
        valueLabels: false
    });

    if (chart.horizontal) {
        return null;
    }

    if (chart.points) {
        return (
            <g ref={ref} className={clsx('pointer-events-none', className)}>
                {chart.pointGroups.map((run) => {
                    const first = run.indexes[0]!;

                    const placed = run.indexes.map((index) => {
                        const pixel = values[index] === null ? null : chart.pixelOfY(values[index]!);
                        const left = chart.positions[index]?.[0] ?? null;

                        return pixel === null || left === null ? null : ([left, pixel] as const);
                    });

                    return (
                        <g
                            key={run.key}
                            opacity={chart.dimmedGroups.has(run.key) ? DIMMED_POINT : 1}
                            style={{ color: rowColors?.[first] ?? color ?? chart.groupColorOf(first) }}
                        >
                            <LinePath points={placed} curve={curve} dashed={dashed} dots={false} width={width} />
                        </g>
                    );
                })}
            </g>
        );
    }

    return (
        <g ref={ref} className={clsx('pointer-events-none', className)} style={{ color: chart.colors.get(id) ?? color ?? seriesColor(0) }}>
            <LinePath points={pointsOf(chart, values)} curve={curve} dashed={dashed} dots={dots} width={width} />
        </g>
    );
}

/*
 * A dot per value. On a point chart the dots are what the cursor and the keyboard move between: the one under the
 * cursor and every picked one grow, and a ring marks a picked one and the one the keyboard is on.
 */
export function ChartPoint<Row>({ value, label, tone, icon, className, ref }: ChartPointProps<Row>) {
    const [chart, id, values] = useSeriesValues('Chart.Point', value);
    const [color, rowColors] = tonesOf(chart, tone);

    useRegistration(chart.store, 'series', id, {
        kind: 'point',
        label,
        color,
        rowColors,
        values,
        stack: null,
        bars: null,
        curve: 'linear',
        icon: icon ?? null,
        valueLabels: false
    });

    const fallback = chart.colors.get(id) ?? seriesColor(0);

    if (chart.horizontal) {
        return null;
    }

    return (
        <g ref={ref} className={clsx('pointer-events-none', className)}>
            {values.map((amount, index) => {
                const pixel = amount === null ? null : chart.pixelOfY(amount);
                const left = chart.points ? (chart.positions[index]?.[0] ?? null) : chart.centerOf(index);

                if (pixel === null || left === null || !Number.isFinite(left)) {
                    return null;
                }

                const active = index === chart.activeIndex;
                const picked = chart.selected[index] === true;
                const fill = rowColors?.[index] ?? color ?? (chart.points ? chart.groupColorOf(index) : fallback);

                return (
                    <g key={chart.keys?.[index] ?? index} opacity={chart.dimmed[index] === true ? DIMMED_POINT : 1}>
                        <circle cx={left} cy={pixel} r={active || picked ? 5 : 4} strokeWidth={1} style={{ fill, stroke: chart.halo }} />
                        {(picked || index === chart.keyIndex) && <circle cx={left} cy={pixel} r={8} fill="none" className="stroke-text" strokeWidth={2} />}
                    </g>
                );
            })}
        </g>
    );
}

/* A line with its area filled down to zero, or down to the stacked areas before it. */
export function ChartArea<Row>({
    value,
    label,
    tone,
    icon,
    curve = 'linear',
    dashed = false,
    dots = false,
    stack = false,
    width = 2,
    fill: fillKind = 'gradient',
    className,
    ref
}: ChartAreaProps<Row>) {
    const [chart, id, values] = useSeriesValues('Chart.Area', value);
    const flat = stack || fillKind === 'flat';
    const gradient = `chart-area-${id.replace(/[^\w-]/g, '')}`;

    useRegistration(chart.store, 'series', id, {
        kind: 'area',
        label,
        color: colorOf(tone),
        rowColors: null,
        values,
        stack: stack ? 'area' : null,
        bars: null,
        curve,
        icon: icon ?? null,
        valueLabels: false
    });

    if (chart.horizontal) {
        return null;
    }

    const stacked = chart.stacked.get(id);
    const tops = pointsOf(chart, stacked?.top ?? values);
    const ground = groundOf(chart);

    const fill = area<number>()
        .defined((index) => tops[index] !== null)
        .x((index) => tops[index]![0])
        .y1((index) => tops[index]![1])
        .y0((index) => (stacked === undefined ? ground : (chart.pixelOfY(stacked.base[index]!) ?? ground)))
        .curve(CURVES[curve])(tops.map((_, index) => index));

    return (
        <g ref={ref} className={clsx('pointer-events-none', className)} style={{ color: chart.colors.get(id) ?? colorOf(tone) ?? seriesColor(0) }}>
            {flat ? null : (
                <defs>
                    <linearGradient id={gradient} x1={0} x2={0} y1={0} y2={1}>
                        <stop offset="0%" stopColor="currentColor" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                </defs>
            )}
            {fill !== null && <path d={fill} fill={flat ? 'currentColor' : `url(#${gradient})`} fillOpacity={flat ? FLAT_FILL : 1} />}
            <LinePath points={tops} curve={curve} dashed={dashed} dots={dots} width={width} />
        </g>
    );
}

/* A group of `Chart.Bar` that shares the width of a bucket, side by side or stacked. */
export function ChartBars({ stack = false, children, className, ref }: ChartBarsProps) {
    const id = useId();

    return (
        <BarsContext value={{ id, stack }}>
            <g ref={ref} className={className}>
                {children}
            </g>
        </BarsContext>
    );
}

/* Columns, one per bucket: on a `band` scale, or on a `time` scale whose buckets last one step. Bars per row in a horizontal chart. */
export function ChartBar<Row>({
    value,
    label,
    tone,
    icon,
    opacity,
    hoverOpacity = HOVER_DIM,
    dimOpacity = OUT_OF_FOCUS,
    columnWidth,
    radius = 2,
    minHeight = 0,
    rounded = 'all',
    valueLabels,
    valueLabelSize: labelSize,
    animate = false,
    className,
    ref
}: ChartBarProps<Row>) {
    const [chart, id, values] = useSeriesValues('Chart.Bar', value);
    const bars = useContext(BarsContext);
    const labels = useRef<SVGGElement>(null);
    const [widths, setWidths] = useState<ReadonlyMap<string, number>>(() => new Map());
    const rows = chart.data as Row[];
    const [color, rowColors] = tonesOf(chart, tone);
    const labeled = valueLabels !== undefined && valueLabels !== false;
    const { horizontal } = chart;
    // A value beside a row reads with the name of the row, which is written a size larger than a label over a column.
    const valueLabelSize = labelSize ?? (horizontal ? 'xs' : '2xs');
    const stack = bars?.stack === true ? bars.id : null;
    const writeValue = typeof valueLabels === 'function' ? valueLabels : (amount: number): string => chart.formatY(amount);
    // A horizontal stack has room for one value past its end: its total, which its last part with labels writes.
    const totals = horizontal && stack !== null;
    const writesLabels = labeled && (!totals || [...chart.series].findLast(([, entry]) => entry.stack === stack && entry.valueLabels)?.[0] === id);
    const others = totals ? [...chart.series].flatMap(([seriesId, entry]) => (entry.stack === stack && seriesId !== id ? [entry] : [])) : [];

    const labelValueAt = (index: number): number | null => {
        const parts = [values[index], ...others.map((entry) => entry.values[index])].filter((part): part is number => part !== null && part !== undefined);

        return parts.length === 0 ? null : parts.reduce((sum, part) => sum + part, 0);
    };

    const rowTexts = values.map((_, index) => {
        const amount = labelValueAt(index);

        return horizontal && writesLabels && amount !== null ? writeValue(amount, rows[index]!, index) : '';
    });

    const widthOf = (text: string): number => widths.get(text) ?? guessLabelWidth(text, valueLabelSize);
    const endRoom = horizontal && writesLabels ? Math.max(0, ...rowTexts.map(widthOf)) + LABEL_INSET + 2 : 0;

    useRegistration(chart.store, 'series', id, {
        kind: 'bar',
        label,
        color,
        rowColors,
        values,
        stack,
        bars: bars?.id ?? null,
        curve: 'linear',
        icon: icon ?? null,
        valueLabels: labeled,
        dimOpacity,
        endRoom
    });

    // A time scale learns how long a bucket is from the distance between two rows, so one row alone has no slot.
    const noSlot = chart.xScale === 'time' && chart.data.length > 0 && chart.bucketAt(0) === null;

    useEffect(() => {
        if (noSlot) {
            warnOnce('Chart.Bar: a time scale with one row draws no columns without a `step` on the root.');
        }
    }, [noSlot]);

    const { slot, count } = chart.slots.get(id) ?? { slot: 0, count: 1 };
    const stacked = chart.stacked.get(id);
    const fallback = chart.colors.get(id) ?? seriesColor(0);
    const anySelected = chart.selected.some(Boolean);

    const groupOf = (index: number): { first: number; last: number } =>
        chart.band?.groups.find((run) => index >= run.first && index <= run.last) ?? { first: 0, last: values.length - 1 };

    const focusOf = (index: number): { focused: boolean; outOfFocus: boolean } => {
        const focused = index === chart.activeIndex || chart.selected[index] === true;

        return { focused, outOfFocus: chart.dimmed[index] === true || (anySelected && !focused) };
    };

    const drawn = values.flatMap((amount, index) => {
        const top = stacked?.top[index];
        const base = stacked?.base[index] ?? 0;
        const topPixel = top === null || top === undefined ? null : chart.pixelOfY(top);
        const basePixel = chart.pixelOfY(base) ?? (horizontal ? chart.plot.left : chart.plot.bottom);
        const bucket = chart.bucketAt(index);

        if (amount === null || topPixel === null || bucket === null) {
            return [];
        }

        const column = columnsIn(bucket.left, bucket.width, count, columnWidth)[slot]!;
        const least = stack === null ? minHeight : 0;
        let box: { x: number; y: number; width: number; height: number };

        if (horizontal) {
            // A segment is measured up an axis that grows downward; mirrored, the same rules hold for a bar that grows rightward.
            const segment = segmentOf(-topPixel, -basePixel, base === 0, amount, least);
            box = { x: -(segment.y + segment.height), y: column.x, width: segment.height, height: column.width };
        } else {
            const segment = segmentOf(topPixel, basePixel, base === 0, amount, least);
            box = { x: column.x, y: segment.y, width: column.width, height: segment.height };
        }

        const { focused, outOfFocus } = focusOf(index);
        const run = groupOf(index);
        let alpha = focused ? 1 : (opacity?.(rows[index]!, index - run.first, run.last - run.first + 1) ?? 1);

        if (outOfFocus) {
            alpha *= dimOpacity;
        } else if (chart.activeIndex >= 0 && !focused) {
            alpha *= hoverOpacity;
        }

        const text = labeled && !horizontal ? writeValue(amount, rows[index]!, index) : '';

        return [{ index, box, alpha, outOfFocus, text }];
    });

    const labelTops = horizontal
        ? []
        : placeValueLabels(
              drawn.map(({ box, text }) => ({ center: box.x + box.width / 2, top: box.y, width: widthOf(text) })),
              valueLabelSize
          );

    // A value stands past the end of its bar, or of its stack, in the middle of the bar's height.
    const rowLabels = rowTexts.flatMap((text, index) => {
        const total = labelValueAt(index);
        const bucket = chart.bucketAt(index);

        if (text === '' || total === null || bucket === null) {
            return [];
        }

        const column = columnsIn(bucket.left, bucket.width, count, columnWidth)[slot]!;
        const own = totals ? undefined : drawn.find((entry) => entry.index === index)?.box;
        const end = own === undefined ? (chart.pixelOfY(total) ?? chart.plot.left) : total >= 0 ? own.x + own.width : own.x;

        return [
            {
                index,
                text,
                x: Math.round(total >= 0 ? end + LABEL_INSET : end - LABEL_INSET),
                y: Math.round(column.x + column.width / 2),
                anchor: total >= 0 ? ('start' as const) : ('end' as const),
                outOfFocus: focusOf(index).outOfFocus
            }
        ];
    });

    useBeforePaint(() => {
        const texts = [...(labels.current?.querySelectorAll('text') ?? [])];

        if (texts.length === 0 || typeof texts[0]!.getComputedTextLength !== 'function') {
            return;
        }

        const next = new Map(texts.map((node) => [node.textContent ?? '', Math.ceil(node.getComputedTextLength())]));

        if (next.size !== widths.size || [...next].some(([text, width]) => widths.get(text) !== width)) {
            setWidths(next);
        }
    });

    return (
        <g ref={ref} className={clsx('pointer-events-none', className)}>
            <g
                className={
                    animate
                        ? clsx(
                              'transition-[scale] duration-400 ease-out motion-reduce:transition-none',
                              horizontal ? 'starting:scale-x-0' : 'starting:scale-y-0'
                          )
                        : undefined
                }
                style={animate ? { transformOrigin: horizontal ? `${groundOf(chart)}px 0px` : `0px ${groundOf(chart)}px` } : undefined}
            >
                {drawn.map(({ index, box, alpha }) => {
                    const thickness = horizontal ? box.height : box.width;
                    const corner = stack !== null ? 0 : Math.min(radius, Math.floor(thickness / 4));
                    const fill = rowColors?.[index] ?? color ?? fallback;
                    const forward = (values[index] ?? 0) >= 0;

                    return rounded === 'end' && corner > 0 ? (
                        <path
                            key={index}
                            d={
                                horizontal
                                    ? endRoundedBar(box.x, box.y, box.width, box.height, corner, forward)
                                    : endRoundedColumn(box.x, box.y, box.width, box.height, corner, forward)
                            }
                            opacity={alpha}
                            style={{ fill }}
                        />
                    ) : (
                        <rect key={index} {...box} rx={corner} opacity={alpha} style={{ fill }} />
                    );
                })}
            </g>
            <g ref={labels}>
                {rowLabels.map(({ index, text, x, y, anchor, outOfFocus }) => (
                    <text
                        key={`label-${index}`}
                        x={x}
                        y={y}
                        dy="0.32em"
                        textAnchor={anchor}
                        opacity={outOfFocus ? dimOpacity : 1}
                        aria-hidden
                        strokeWidth={3}
                        paintOrder="stroke"
                        style={{ stroke: chart.halo }}
                        className={clsx('fill-text tabular-nums', valueLabelSize === 'xs' ? 'text-xs' : 'text-2xs')}
                    >
                        {text}
                    </text>
                ))}
                {labeled &&
                    !horizontal &&
                    drawn.map(({ index, box, outOfFocus, text }, i) => {
                        const center = Math.round(box.x + box.width / 2);
                        const y = box.y;
                        const baseline = labelTops[i]!;

                        return (
                            <g key={`label-${index}`} opacity={outOfFocus ? dimOpacity : 1} aria-hidden>
                                {baseline < y - LABEL_LIFT - 2 && (
                                    <line x1={center + 0.5} x2={center + 0.5} y1={y - 4} y2={baseline + 4} className="stroke-border-strong" />
                                )}
                                <text
                                    x={center}
                                    y={baseline}
                                    textAnchor="middle"
                                    strokeWidth={3}
                                    paintOrder="stroke"
                                    style={{ stroke: chart.halo }}
                                    className={clsx('fill-text tabular-nums', valueLabelSize === 'xs' ? 'text-xs' : 'text-2xs')}
                                >
                                    {text}
                                </text>
                            </g>
                        );
                    })}
            </g>
        </g>
    );
}
