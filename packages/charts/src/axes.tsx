import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatRounded } from '@adecore/ui/format';
import { useChartContext } from './context.ts';
import { decimalsOf, tickCount } from './scale.ts';
import { useBeforePaint } from './register.ts';
import { formatTime, timeLabelOf } from './time-format.ts';
import type { ChartX } from './types.ts';

export interface ChartGridProps {
    readonly axis?: 'y' | 'x' | 'both';
    /* Dashes every line but the ground, in the color of the ground so the dashes still read as a line. */
    readonly dashed?: boolean;
    /* `ground` draws the line the values stand on and nothing else, for columns that need no scale to be read. */
    readonly lines?: 'all' | 'ground';
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

export interface ChartXAxisProps {
    /* Writes a bucket's x in this row. The tooltip, the live region and the table name a bucket by every row, the lowest first. */
    readonly format?: (x: ChartX) => string;
    /* A target count of ticks on a continuous scale; the axis drops ticks whose labels would not fit. */
    readonly ticks?: number;
    /* Slants the labels, for long names under every column of a ranked row. */
    readonly angle?: 0 | -40;
    /* Leaves labels of a band scale out where they would overlap; false writes one under every bucket. */
    readonly thin?: boolean;
    /* On a time scale of buckets, `bucket` writes the start of each bucket under its middle instead of round moments on their tick, as columns per day read. */
    readonly align?: 'tick' | 'bucket';
    /* What the axis measures, centered under its labels; a log scale adds that it is one. A point chart reads it out with each x. */
    readonly title?: string;
    /* What the tooltip, the live region and the table call the x of a point, when the title is too long to read out each time. */
    readonly label?: string;
    /* What a log scale adds to the title, "logarithmic" by default; an empty string adds nothing. */
    readonly logLabel?: string;
    /* Hears whether labels of buckets were left out for lack of room, such as to tell a person the table has them all. */
    readonly onThinnedChange?: (thinned: boolean) => void;
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

export interface ChartYAxisProps {
    /* Writes a value, here and in the tooltip, the live region and the table. */
    readonly format?: (value: number) => string;
    /* A target count of ticks. */
    readonly ticks?: number;
    readonly side?: 'left' | 'right';
    /* What the axis measures, or its unit, written above the plot where the axis starts. */
    readonly title?: string;
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

export interface ChartBucketGroup<Row> {
    readonly key: string;
    /* The `groupLabel` of the root for the group's first row, else its key. */
    readonly label: string;
    readonly rows: readonly Row[];
    /* The index of the group's first and last bucket. */
    readonly first: number;
    readonly last: number;
}

export interface ChartGroupAxisProps<Row> {
    readonly children: (group: ChartBucketGroup<Row>) => ReactNode;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/* Between the end of a label and the plot, and between two labels on the x axis. */
export const LABEL_GAP = 8;
/* Labels of a category sit under their own column, so they need less air between them than round ticks do. */
const BAND_LABEL_GAP = 4;
const X_LABEL_LINE = 16;
const X_TICK_SPACING = 96;
/* What a label is taken to measure before it has been drawn once. */
const GUESS = 48;
const SLANT = (40 * Math.PI) / 180;
const DASH = '2 5';
/* The row an x axis title takes under its labels. */
const X_TITLE_ROOM = 21;
/* The baseline of a y axis title from the top of the chart, and the room above the plot it needs. */
const Y_TITLE_BASELINE = 15;
const Y_TITLE_ROOM = 28;

/* The height a row of labels takes under the plot, more for a slanted one. */
const roomOf = (widest: number, angle: number): number => Math.ceil(angle === 0 ? X_LABEL_LINE : widest * Math.sin(SLANT) + X_LABEL_LINE * Math.cos(SLANT));

const textWidth = (node: SVGTextElement): number =>
    typeof node.getComputedTextLength === 'function' ? node.getComputedTextLength() : (node.textContent?.length ?? 0) * 7;

const widestIn = (group: SVGGElement | null): number => Math.max(0, ...[...(group?.querySelectorAll('text') ?? [])].map(textWidth));

/* A line sits on the middle of a pixel, so one pixel wide stays one pixel wide. */
const crisp = (pixel: number): number => Math.round(pixel) + 0.5;

/*
 * The labels, from left to right, with every one left out that comes nearer to the one before it than `spacing`.
 * A label on an end of the axis wins over its neighbor, so both ends stay named.
 */
const apart = <Label extends { readonly x: number; readonly end?: boolean }>(labels: readonly Label[], spacing: number): Label[] => {
    const kept: Label[] = [];
    for (const label of labels) {
        const last = kept.at(-1);
        if (last === undefined || label.x - last.x >= spacing) {
            kept.push(label);
        } else if (label.end === true && last.end !== true) {
            kept[kept.length - 1] = label;
        }
    }
    return kept;
};

/* Gridlines on the ticks, a heavier one on the ground. */
export function ChartGrid({ axis = 'y', dashed = false, lines = 'all', className, ref }: ChartGridProps) {
    const chart = useChartContext('Chart.Grid');
    const { plot, y, continuous, band } = chart;
    const ground = y.domain[0] <= 0 && y.domain[1] >= 0 ? 0 : y.domain[0];
    if (lines === 'ground') {
        const pixel = y.at(ground);
        return pixel === null ? null : (
            <g ref={ref} className={clsx('pointer-events-none', className)} aria-hidden>
                <line x1={plot.left} x2={plot.right} y1={crisp(pixel)} y2={crisp(pixel)} className={dashed ? 'stroke-border' : 'stroke-border-strong'} />
            </g>
        );
    }
    const columns =
        continuous !== null
            ? continuous.ticks(tickCount(plot.width, X_TICK_SPACING)).map((tick) => continuous.at(tick))
            : chart.xs.map((_, index) => chart.centerOf(index));
    return (
        <g ref={ref} className={clsx('pointer-events-none', className)} aria-hidden>
            {axis !== 'x' &&
                y.ticks.map((tick) => {
                    const pixel = y.at(tick);
                    return pixel === null ? null : (
                        <line
                            key={tick}
                            x1={plot.left}
                            x2={plot.right}
                            y1={crisp(pixel)}
                            y2={crisp(pixel)}
                            strokeDasharray={dashed && tick !== ground ? DASH : undefined}
                            className={dashed ? 'stroke-border' : tick === ground ? 'stroke-border-strong' : 'stroke-border-soft'}
                        />
                    );
                })}
            {axis !== 'y' &&
                (band === null || chart.xs.length > 0) &&
                columns.map((pixel) => (
                    <line
                        key={pixel}
                        x1={crisp(pixel)}
                        x2={crisp(pixel)}
                        y1={plot.top}
                        y2={plot.bottom}
                        strokeDasharray={dashed ? DASH : undefined}
                        className={dashed ? 'stroke-border' : 'stroke-border-soft'}
                    />
                ))}
        </g>
    );
}

/* The labels under the plot: one per bucket on a band scale as far as they fit, round ticks on a continuous one. */
export function ChartXAxis({
    format,
    ticks,
    angle = 0,
    thin = true,
    align = 'tick',
    title,
    label: spoken,
    logLabel,
    onThinnedChange,
    className,
    ref
}: ChartXAxisProps) {
    const chart = useChartContext('Chart.XAxis');
    const { t } = useTranslation('charts');
    const { store, plot, continuous, band, xs } = chart;
    const id = useId();
    useAxisTitle(spoken ?? title);
    const labels = useRef<SVGGElement>(null);
    const candidates = useRef<SVGGElement>(null);
    const grown = useRef({ key: '', width: 0 });
    const rows = useSyncExternalStore(store.subscribe, store.xAxes, store.xAxes);
    const widest = rows.get(id)?.widest ?? GUESS;
    let above = 0;
    for (const [rowId, row] of rows) {
        if (rowId === id) {
            break;
        }
        above += row.room;
    }
    const baseline = plot.bottom + LABEL_GAP + above;
    const domainKey = continuous === null ? '' : `${continuous.domain.join(':')}:${Math.round(plot.width)}`;
    const write = format ?? chart.formatX;

    useBeforePaint(() => {
        // Measuring only the placed labels can flip between two sets forever, since the widest decides how many are placed.
        // A band scale measures every label; the ticks of a continuous one only let the width grow per domain.
        let width = Math.ceil(widestIn(continuous === null ? candidates.current : labels.current));
        if (continuous !== null) {
            width = grown.current.key === domainKey ? Math.max(width, grown.current.width) : width;
            grown.current = { key: domainKey, width };
        }
        store.setXAxis(id, { widest: width, room: roomOf(width, angle) + (title === undefined ? 0 : X_TITLE_ROOM), format });
    });
    useBeforePaint(() => () => store.setXAxis(id, null), [store, id]);

    const inward = (x: number): number => Math.min(Math.max(x, widest / 2 - chart.leftAxis), chart.width - widest / 2);
    let placed: { key: string; x: number; text: string; end?: boolean; index?: number }[];
    const buckets = align === 'bucket' && chart.xScale === 'time' && !chart.points ? chart.bucketAt(0) : null;
    if (continuous !== null && xs.length === 0) {
        placed = [];
    } else if (continuous !== null && buckets !== null && buckets.width > 0) {
        // The start of a bucket under its middle, as columns of days read, every bucket as far as the labels fit.
        const span = continuous.domain[1] - continuous.domain[0];
        const label = timeLabelOf(span, (buckets.width / Math.max(1, plot.width)) * span);
        const every = thin ? Math.max(1, Math.ceil((widest + BAND_LABEL_GAP) / buckets.width)) : 1;
        placed = xs.flatMap((key, index) =>
            index % every !== 0
                ? []
                : [{ key: String(key), x: inward(chart.centerOf(index)), text: format !== undefined ? format(key) : formatTime(key as number, label) }]
        );
    } else if (continuous !== null) {
        const values = continuous.ticks(ticks ?? tickCount(plot.width, widest + 3 * LABEL_GAP));
        const step = values.length > 1 ? values[1]! - values[0]! : continuous.domain[1] - continuous.domain[0];
        const label = timeLabelOf(continuous.domain[1] - continuous.domain[0], step);
        const decimals = decimalsOf(step);
        placed = values
            .map((tick) => {
                // A tick on an end of the axis, such as the last decade of a log scale, still names that end when moved in.
                const end = tick === continuous.domain[0] || tick === continuous.domain[1];
                return {
                    key: String(tick),
                    x: end ? inward(continuous.at(tick)) : continuous.at(tick),
                    text: format !== undefined ? format(tick) : chart.xScale === 'time' ? formatTime(tick, label) : formatRounded(tick, decimals),
                    end
                };
            })
            // Any other label that would hang past the end of the chart is left out rather than moved off its tick.
            .filter((tick) => tick.x - widest / 2 >= -chart.leftAxis && tick.x + widest / 2 <= chart.width + 1);
        placed = apart(placed, widest + LABEL_GAP);
    } else if (band !== null && band.bucket > 0) {
        const every = thin ? Math.max(1, Math.ceil((angle === 0 ? widest + BAND_LABEL_GAP : X_LABEL_LINE) / band.bucket)) : 1;
        placed = xs.flatMap((key, index) => {
            if (index % every !== 0) {
                return [];
            }
            const center = chart.centerOf(index);
            return [{ key: String(key), x: angle === 0 ? inward(center) : center, text: write(key), index }];
        });
    } else {
        placed = [];
    }
    // Only an axis with a label per bucket leaves a bucket unnamed; round ticks of a continuous one name no bucket.
    const named = (band !== null && band.bucket > 0) || buckets !== null;
    const thinned = named ? placed.length < xs.length : null;
    const reported = useRef<boolean | null>(null);
    useEffect(() => {
        if (thinned !== null && reported.current !== thinned) {
            reported.current = thinned;
            onThinnedChange?.(thinned);
        }
    });

    return (
        <g ref={ref} className={clsx('pointer-events-none', className)} aria-hidden>
            {band !== null && (
                <g ref={candidates} visibility="hidden">
                    {xs.map((key) => (
                        <text key={String(key)} className="text-xs tabular-nums">
                            {write(key)}
                        </text>
                    ))}
                </g>
            )}
            <g ref={labels}>
                {placed.map((tick) => {
                    const focus = tick.index === undefined ? null : (chart.labelFocus[tick.index] ?? null);
                    const opacity = focus === 'dim' ? chart.labelDim : undefined;
                    return angle === 0 ? (
                        <text
                            key={tick.key}
                            x={Math.round(tick.x)}
                            y={baseline}
                            dy="0.8em"
                            textAnchor="middle"
                            opacity={opacity}
                            className={clsx(focus === 'strong' ? 'fill-text' : 'fill-text-faint', 'text-xs tabular-nums')}
                        >
                            {tick.text}
                        </text>
                    ) : (
                        <text
                            key={tick.key}
                            transform={`translate(${Math.round(tick.x) + 4},${baseline}) rotate(${angle})`}
                            dy="0.8em"
                            textAnchor="end"
                            opacity={opacity}
                            className={clsx(focus === 'strong' ? 'fill-text' : 'fill-text-muted', 'text-xs')}
                        >
                            {tick.text}
                        </text>
                    );
                })}
            </g>
            {title !== undefined && (
                <text
                    x={Math.round((plot.left + plot.right) / 2)}
                    y={baseline + roomOf(widest, angle) + X_TITLE_ROOM - 4}
                    textAnchor="middle"
                    className="fill-text-muted text-xs"
                >
                    {chart.xScale === 'log' && logLabel !== '' ? `${title} · ${logLabel ?? t('axis.logarithmic')}` : title}
                </text>
            )}
        </g>
    );
}

/* Tells the root the title of the x axis, which a point chart reads out with each x; an axis without one says nothing. */
function useAxisTitle(title: string | undefined): void {
    const { store } = useChartContext('Chart.XAxis');
    useBeforePaint(() => {
        if (title !== undefined) {
            store.setFormat('xTitle', title);
        }
    });
    useBeforePaint(
        () => () => {
            if (title !== undefined) {
                store.setFormat('xTitle', undefined);
            }
        },
        [store, title]
    );
}

/* The value labels beside the plot. It measures its widest label and gives the plot the rest. */
export function ChartYAxis({ format, ticks, side = 'left', title, className, ref }: ChartYAxisProps) {
    const chart = useChartContext('Chart.YAxis');
    const { store, y, yStep } = chart;
    const labels = useRef<SVGGElement>(null);
    const target = side === 'left' ? chart.elements.left : chart.elements.right;

    useBeforePaint(() => {
        store.setYAxis(side, {
            width: labels.current === null ? (store.yAxes().get(side)?.width ?? null) : Math.ceil(widestIn(labels.current)) + LABEL_GAP,
            ticks: ticks ?? null,
            top: title === undefined ? null : Y_TITLE_ROOM,
            format
        });
    });
    useBeforePaint(() => () => store.setYAxis(side, null), [store, side]);

    if (target === null) {
        return null;
    }
    const decimals = decimalsOf(yStep);
    return createPortal(
        <g ref={ref} className={className}>
            <g ref={labels}>
                {y.ticks.map((tick) => {
                    const pixel = y.at(tick);
                    return pixel === null ? null : (
                        <text
                            key={tick}
                            x={side === 'left' ? chart.leftAxis - LABEL_GAP : LABEL_GAP}
                            y={Math.round(pixel)}
                            dy="0.32em"
                            textAnchor={side === 'left' ? 'end' : 'start'}
                            className="fill-text-faint text-xs tabular-nums"
                        >
                            {(format ?? chart.valueFormat)?.(tick) ?? formatRounded(tick, decimals)}
                        </text>
                    );
                })}
            </g>
            {title !== undefined && (
                // Over the plot where the axis starts, so a unit reads before the values and needs no turned text.
                <text
                    x={side === 'left' ? chart.leftAxis + Math.round(chart.plot.left) : -Math.round(chart.width - chart.plot.right)}
                    y={Y_TITLE_BASELINE}
                    textAnchor={side === 'left' ? 'start' : 'end'}
                    className="fill-text-muted text-xs"
                >
                    {title}
                </text>
            )}
        </g>,
        target
    );
}

/* A second row of labels under the x axis, one per group and centered under it. HTML, so a mark or a logo fits. */
export function ChartGroupAxis<Row>({ children, className, ref }: ChartGroupAxisProps<Row>) {
    const chart = useChartContext('Chart.GroupAxis');
    const target = chart.elements.groups;
    if (target === null || chart.band === null) {
        return null;
    }
    const rows = chart.data as Row[];
    const band = chart.band;
    return createPortal(
        <div ref={ref} aria-hidden className={clsx('grid pt-1 text-xs', className)}>
            {band.groups.map((run) => (
                <div
                    key={`${run.key}:${run.first}`}
                    className="col-start-1 row-start-1 flex min-w-0 flex-col items-center gap-1 px-1 text-center"
                    // The gap belongs to no group, so a name takes half of it on each side before it wraps.
                    style={{ marginLeft: Math.round(chart.plot.left + run.left - band.gap / 2), width: Math.round(run.right - run.left + band.gap) }}
                >
                    {children({
                        key: run.key,
                        label: chart.groupLabels?.[run.first] ?? run.key,
                        rows: rows.slice(run.first, run.last + 1),
                        first: run.first,
                        last: run.last
                    })}
                </div>
            ))}
        </div>,
        target
    );
}
