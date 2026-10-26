import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';
import { colorOf } from './color.ts';
import { useChartContext } from './context.ts';
import { frontierOf, spreadLabels } from './points.ts';
import { useBeforePaint } from './register.ts';
import { DIMMED_POINT } from './series.tsx';
import type { ChartColor } from './types.ts';

export interface ChartFrontierProps {
    /* A low x is the better one, as a cost is; false for a higher x, such as a speed. */
    readonly lowerX?: boolean;
    /* A high value is the better one; false for a lower value, such as a time. */
    readonly higherY?: boolean;
    /* The width of the band in pixels. */
    readonly width?: number;
    /* `--border` by default, an alpha over what is behind it. */
    readonly tone?: ChartColor;
    readonly className?: string;
    readonly ref?: Ref<SVGPolylineElement>;
}

/* A series of a point chart, as `Chart.EndLabels` hands it to its children. */
export interface ChartPointSeries<Row> {
    readonly key: string;
    /* The `groupLabel` of its first row, else its key. */
    readonly label: string;
    readonly rows: readonly Row[];
    /* The CSS color its points are drawn in. */
    readonly color: string;
}

export interface ChartEndLabelsProps<Row> {
    /* What a label holds, such as a logo and a name; the name in the series color by default. */
    readonly children?: (series: ChartPointSeries<Row>) => ReactNode;
    /* The pixels the labels take right of the plot: 118, or 156 in a chart wider than 750px. */
    readonly width?: number;
    readonly className?: string;
    readonly ref?: Ref<SVGGElement>;
}

/* The least distance between the middles of two labels, and how far a label stands from the plot and its leader. */
const LABEL_SPACING = 24;
const LEADER_END = 12;
const LABEL_START = 18;

/* A wide soft band through the points no other point beats on both axes, such as the best value for a cost. */
export function ChartFrontier({ lowerX = true, higherY = true, width = 14, tone, className, ref }: ChartFrontierProps) {
    const chart = useChartContext('Chart.Frontier');
    // On pixels a higher value stands lower, so the y is turned around before the frontier compares it.
    const placed = chart.positions.flatMap((position) => (position === null ? [] : [{ x: position[0], y: -position[1] }]));
    const band = frontierOf(placed, lowerX, higherY);

    if (band.length < 2) {
        return null;
    }

    return (
        <polyline
            ref={ref}
            aria-hidden
            points={band.map((point) => `${Math.round(point.x)},${Math.round(-point.y)}`).join(' ')}
            fill="none"
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={clsx('pointer-events-none', className)}
            style={{ stroke: colorOf(tone) ?? 'var(--border)' }}
        />
    );
}

/* A label right of the plot at the last point of each series, pushed apart where two would overlap, with a line to its point. */
export function ChartEndLabels<Row>({ children, width, className, ref }: ChartEndLabelsProps<Row>) {
    const chart = useChartContext('Chart.EndLabels');
    const { store, plot, pointGroups, positions } = chart;
    const columnWidth = width ?? (chart.box > 750 ? 156 : 118);
    const room = columnWidth + LABEL_START - 6;

    useBeforePaint(() => {
        store.setAxis('end', room);
    });

    useBeforePaint(() => () => store.setAxis('end', null), [store]);

    const ends = pointGroups.flatMap((run) => {
        const last = run.indexes.findLast((index) => positions[index] !== null);

        return last === undefined ? [] : [{ run, point: positions[last]! }];
    });

    const centers = spreadLabels(
        ends.map(({ point }) => point[1]),
        LABEL_SPACING,
        plot.top,
        plot.bottom - 8
    );

    const rows = chart.data as Row[];
    const left = Math.round(plot.right);

    return (
        <g ref={ref} className={clsx('pointer-events-none', className)} aria-hidden>
            {ends.map(({ run, point }, i) => {
                const first = run.indexes[0]!;
                const color = chart.pointColor(first);
                const center = Math.round(centers[i]!);

                const series = {
                    key: run.key,
                    label: chart.groupLabels?.[first] ?? run.key,
                    rows: run.indexes.map((index) => rows[index]!),
                    color
                };

                return (
                    <g key={run.key} opacity={chart.dimmedGroups.has(run.key) ? DIMMED_POINT : 1} style={{ color }}>
                        <line x1={point[0] + 7} y1={point[1]} x2={left + LEADER_END} y2={center} stroke="currentColor" opacity={0.3} />
                        <foreignObject x={left + LABEL_START} y={center - 12} width={Math.max(0, columnWidth - 22)} height={24}>
                            <div className="flex h-full items-center gap-2 text-xs font-medium">
                                {children === undefined ? <span className="truncate">{series.label}</span> : children(series)}
                            </div>
                        </foreignObject>
                    </g>
                );
            })}
        </g>
    );
}
