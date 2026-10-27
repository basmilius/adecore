import { useId, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Surface, useContentSize } from '@adecore/ui';
import { useChartContext, type ChartContextValue } from './context.ts';
import type { SeriesEntry } from './store.ts';
import type { ChartNote, ChartX } from './types.ts';
import { tableClasses } from './values-table.ts';

export interface ChartBucketValue {
    readonly label: string;
    readonly color: string;
    readonly value: number;
}

/* The bucket under the cursor, as `Chart.Tooltip` hands it to its children. */
export interface ChartBucket<Row> {
    readonly index: number;
    readonly x: ChartX;
    readonly row: Row;
    /* The key of the bucket's group, null without groups. */
    readonly group: string | null;
    /* What a person reads for the group: `groupLabel` of the root, else the key. */
    readonly groupLabel: string | null;
    readonly values: readonly ChartBucketValue[];
    /* The markers and bands of the bucket. */
    readonly notes: readonly ChartNote[];
}

export interface ChartTooltipProps<Row> {
    /* A line with the sum of the values under the series, named "Total" or by the string given, such as "Runs". */
    readonly total?: boolean | string;
    /* Writes the values of the card; without it they are written as the y axis writes them. */
    readonly format?: (value: number) => string;
    /* What the card holds in place of its rows. */
    readonly children?: (bucket: ChartBucket<Row>) => ReactNode;
    /*
     * Beside the cursor (`cursor`), or fixed in a corner of the plot. A card in a corner moves to the other side where it
     * would cover the bucket under the cursor.
     */
    readonly placement?: ChartTooltipPlacement;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

export type ChartTooltipPlacement = 'cursor' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ChartLegendProps {
    readonly className?: string;
    readonly ref?: Ref<HTMLUListElement>;
}

/* The rows and columns a table shows in place of the chart's own, such as every series, also those the chart leaves out. */
export interface ChartTableData {
    /* The heading of every column after the one that names a row. */
    readonly columns: readonly string[];
    /* Each row with its name and a written value per column. */
    readonly rows: readonly { readonly key: string; readonly label: string; readonly cells: readonly string[] }[];
}

export interface ChartTableProps {
    /* False leaves out the button: the table is there for a screen reader only. */
    readonly toggle?: boolean;
    readonly open?: boolean;
    readonly defaultOpen?: boolean;
    readonly onOpenChange?: (open: boolean) => void;
    readonly data?: ChartTableData;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/* Between the cursor and the card, and the least room the card keeps to the edge of the chart. */
const OFFSET = 12;
const EDGE = 4;
/* Half the room a point takes, which a card in a corner keeps clear of. */
const POINT_ROOM = 8;

/* The color a series has in a row: its own per row, else on a point chart the color of the row's series. */
const colorAt = (chart: ChartContextValue, id: string, entry: SeriesEntry, index: number): string =>
    entry.rowColors?.[index] ?? (chart.points ? (entry.color ?? chart.groupColorOf(index)) : chart.colors.get(id)!);

const bucketOf = <Row,>(chart: ChartContextValue, index: number): ChartBucket<Row> => ({
    index,
    x: chart.xs[index]!,
    row: chart.data[index] as Row,
    group: chart.groupKeys?.[index] ?? null,
    groupLabel: chart.groupLabels?.[index] ?? null,
    values: chart.readable.flatMap(([id, entry]) => {
        const value = entry.values[index];

        return value === null || value === undefined ? [] : [{ label: entry.label, color: colorAt(chart, id, entry, index), value }];
    }),
    notes: chart.notesAt(index)
});

/*
 * Where the card stands in a horizontal chart. Beside the cursor, it follows the end of the row's longest bar and its
 * value, or goes over or under the row where that leaves no room. In a corner, it moves to the other end of the plot
 * where it would cover the row.
 */
function rowPlace(chart: ChartContextValue, placement: ChartTooltipPlacement, card: { width: number; height: number }): CSSProperties {
    const { activeIndex, plot, leftAxis, box, height } = chart;
    const row = chart.bucketAt(activeIndex) ?? { left: plot.top, width: 0 };
    const plotLeft = leftAxis + plot.left;
    const plotRight = leftAxis + plot.right + chart.valueRoom;

    if (placement !== 'cursor') {
        const [vertical, horizontal] = placement.split('-') as ['top' | 'bottom', 'left' | 'right'];
        const coversTop = row.left < plot.top + card.height;
        const coversBottom = row.left + row.width > plot.bottom - card.height;
        const side = vertical === 'top' ? (coversTop && !coversBottom ? 'bottom' : 'top') : coversBottom && !coversTop ? 'top' : 'bottom';

        return {
            ...(horizontal === 'left' ? { left: Math.round(plotLeft) } : { right: Math.round(box - plotRight) }),
            top: side === 'top' ? Math.round(plot.top) : Math.round(plot.bottom - card.height),
            maxWidth: Math.max(0, Math.round(plotRight - plotLeft))
        };
    }

    const ends = [...chart.series].flatMap(([id]) => {
        const top = chart.stacked.get(id)?.top[activeIndex];
        const pixel = top === null || top === undefined ? null : chart.pixelOfY(top);

        return pixel === null ? [] : [pixel];
    });

    const end = leftAxis + Math.max(plot.left, ...ends) + chart.valueRoom + OFFSET;

    if (end + card.width <= box - EDGE) {
        const center = row.left + row.width / 2;

        return { left: Math.round(end), top: Math.round(Math.max(0, Math.min(height - card.height, center - card.height / 2))) };
    }

    const below = row.left + row.width / 2 < height / 2;

    return {
        left: Math.round(plotLeft),
        maxWidth: Math.max(0, Math.round(box - plotLeft - EDGE)),
        ...(below ? { top: Math.round(row.left + row.width + EDGE) } : { bottom: Math.round(height - row.left + EDGE) })
    };
}

/* The swatch of a series: its icon in its color, else a dash for a line and a square for a column. */
function Swatch({ color, entry, size }: { color: string; entry: SeriesEntry; size: 12 | 14 }) {
    if (entry.icon !== null) {
        return (
            <span className="inline-flex shrink-0" style={{ color }}>
                <Icon icon={entry.icon} size={size} />
            </span>
        );
    }

    return <span className={clsx('shrink-0', entry.kind === 'bar' ? 'size-2 rounded-xs' : 'h-0.5 w-3 rounded-full')} style={{ background: color }} />;
}

/* A dashed stroke for a marker, a square for a band, in their color. */
function NoteSwatch({ note }: { note: ChartNote }) {
    return note.kind === 'marker' ? (
        <span className="flex w-2 shrink-0 justify-center">
            <span className="h-2.5 border-l border-dashed" style={{ borderColor: note.color }} />
        </span>
    ) : (
        <span className="size-2 shrink-0 rounded-xs" style={{ background: note.color }} />
    );
}

/* The card at the cursor: the x of the bucket, a row per series, then its markers and bands. */
export function ChartTooltip<Row>({ total = false, format, children, placement = 'cursor', className, ref }: ChartTooltipProps<Row>) {
    const chart = useChartContext('Chart.Tooltip');
    const { t } = useTranslation('charts');
    const [measure, card] = useContentSize();
    const { activeIndex, elements } = chart;

    if (activeIndex < 0 || elements.tooltip === null || !chart.ownsCursor) {
        return null;
    }

    const bucket = bucketOf<Row>(chart, activeIndex);
    const write = format ?? chart.formatY;
    const position = chart.points ? chart.positions[activeIndex] : null;
    const pixel = chart.leftAxis + (position?.[0] ?? chart.centerOf(activeIndex)) - chart.scroll;
    let place: CSSProperties;

    if (chart.horizontal) {
        place = rowPlace(chart, placement, card);
    } else if (placement === 'cursor') {
        // The card hangs on the side with the most room, so it never covers the cursor and never runs off.
        place = {
            ...(pixel > chart.box / 2
                ? { right: Math.round(chart.box - pixel + OFFSET), maxWidth: Math.max(0, Math.round(pixel - OFFSET - EDGE)) }
                : { left: Math.round(pixel + OFFSET), maxWidth: Math.max(0, Math.round(chart.box - pixel - OFFSET - EDGE)) }),
            top: position === null || position === undefined ? chart.plot.top : Math.max(0, Math.round(position[1]) - OFFSET)
        };
    } else {
        const plotLeft = chart.leftAxis + Math.max(0, chart.plot.left - chart.scroll);
        const plotRight = Math.min(chart.box - chart.rightAxis, chart.leftAxis + chart.plot.right - chart.scroll);
        const reach = (chart.bucketAt(activeIndex)?.width ?? 2 * POINT_ROOM) / 2;
        const [vertical, horizontal] = placement.split('-') as ['top' | 'bottom', 'left' | 'right'];

        const covers = (side: 'left' | 'right'): boolean => (side === 'left' ? pixel - reach < plotLeft + card.width : pixel + reach > plotRight - card.width);

        const side = covers(horizontal) && !covers(horizontal === 'left' ? 'right' : 'left') ? (horizontal === 'left' ? 'right' : 'left') : horizontal;

        place = {
            ...(side === 'left' ? { left: Math.round(plotLeft) } : { right: Math.round(chart.box - plotRight) }),
            top: vertical === 'top' ? Math.round(chart.plot.top) : Math.round(chart.plot.bottom - card.height),
            maxWidth: Math.max(0, Math.round(plotRight - plotLeft))
        };
    }

    const sum = bucket.values.reduce((all, entry) => all + entry.value, 0);

    // A point names its series and itself; its x is a value like the others, under the title of its axis.
    const heading = chart.points
        ? [bucket.groupLabel, chart.rowLabels?.[activeIndex]].filter(Boolean).join(' · ') || chart.formatX(bucket.x)
        : [bucket.groupLabel, chart.rowLabels?.[activeIndex] ?? chart.formatX(bucket.x)].filter(Boolean).join(' · ');

    return createPortal(
        <Surface
            ref={(node: HTMLDivElement | null) => {
                measure(node);

                if (typeof ref === 'function') {
                    ref(node);
                } else if (ref) {
                    ref.current = node;
                }
            }}
            aria-hidden
            className={clsx('absolute flex w-max min-w-36 flex-col gap-1 rounded-lg px-2.5 py-2 text-xs', className)}
            style={place}
        >
            {children !== undefined ? (
                children(bucket)
            ) : (
                <>
                    <p className="font-medium text-text">{heading}</p>
                    {chart.points && (
                        <p className="flex items-center gap-2 text-text-muted">
                            <span className="min-w-0 truncate">{chart.xTitle}</span>
                            <span className="ml-auto pl-3 text-text tabular-nums">{chart.formatX(bucket.x)}</span>
                        </p>
                    )}
                    {chart.readable.map(([id, entry]) => {
                        const value = entry.values[activeIndex];

                        // A series without a value here still gets its row, so a gap reads as nothing measured.
                        return (
                            <p key={id} className="flex items-center gap-2 text-text-muted">
                                <Swatch color={colorAt(chart, id, entry, activeIndex)} entry={entry} size={12} />
                                <span className="min-w-0 truncate">{entry.label}</span>
                                <span className="ml-auto pl-3 text-text tabular-nums">{value === null || value === undefined ? '-' : write(value)}</span>
                            </p>
                        );
                    })}
                    {total !== false && bucket.values.length > 0 && (
                        <p className="flex items-center gap-2 border-t border-border pt-1 font-medium text-text">
                            {total === true ? t('total') : total}
                            <span className="ml-auto pl-3 tabular-nums">{write(sum)}</span>
                        </p>
                    )}
                    {bucket.notes.map((note) => (
                        <div key={`${note.kind}:${note.label}`} className="border-t border-border-soft pt-1">
                            <p className="flex items-center gap-2 text-text">
                                <NoteSwatch note={note} />
                                {note.label}
                            </p>
                            {note.detail !== null && <p className="pl-4 text-text-muted">{note.detail}</p>}
                        </div>
                    ))}
                </>
            )}
        </Surface>,
        elements.tooltip
    );
}

/* The series with their color, in the order of the children; on a point chart the series of its groups. */
export function ChartLegend({ className, ref }: ChartLegendProps) {
    const chart = useChartContext('Chart.Legend');

    if (chart.elements.legend === null) {
        return null;
    }

    return createPortal(
        <ul ref={ref} className={clsx('flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted', className)}>
            {chart.points && chart.groupKeys !== null
                ? chart.pointGroups.map((run) => (
                      <li key={run.key} className="flex items-center gap-1.5">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: chart.pointColor(run.indexes[0]!) }} />
                          {chart.groupLabels?.[run.indexes[0]!] ?? run.key}
                      </li>
                  ))
                : [...chart.series].map(([id, entry]) => (
                      <li key={id} className="flex items-center gap-1.5">
                          <Swatch color={chart.colors.get(id)!} entry={entry} size={14} />
                          {entry.label}
                      </li>
                  ))}
        </ul>,
        chart.elements.legend
    );
}

/* A toggle that shows every value as a table. Hidden, the table is still there for a screen reader. */
export function ChartTable({ toggle = true, open, defaultOpen = false, onOpenChange, data, className, ref }: ChartTableProps) {
    const chart = useChartContext('Chart.Table');
    const { t } = useTranslation('charts');
    const [ownOpen, setOwnOpen] = useState(defaultOpen);
    const id = useId();

    if (chart.elements.table === null) {
        return null;
    }

    const shown = toggle && (open ?? ownOpen);

    const setShown = (next: boolean): void => {
        if (open === undefined) {
            setOwnOpen(next);
        }

        onOpenChange?.(next);
    };

    const grouped = data === undefined && chart.groupKeys !== null;
    // A point names itself by its label where it has one, and its x stands in a column of its own.
    const xColumn = data === undefined && chart.points && chart.rowLabels !== null;
    const columns = data?.columns ?? [...(xColumn ? [chart.xTitle ?? ''] : []), ...chart.readable.map(([, entry]) => entry.label)];

    const rows: { key: string; group: string | null; label: string; cells: readonly string[] }[] =
        data?.rows.map((row) => ({ ...row, group: null })) ??
        chart.xs.flatMap((key, index) =>
            // A point without a position is a gap, which the chart does not draw either.
            chart.points && chart.positions[index] === null
                ? []
                : [
                      {
                          key: chart.keys?.[index] ?? String(key),
                          group: chart.groupLabels?.[index] ?? null,
                          label: chart.rowLabels?.[index] ?? chart.formatX(key),
                          cells: [
                              ...(xColumn ? [Number.isFinite(key) ? chart.formatX(key) : ''] : []),
                              ...chart.readable.map(([, entry]) => {
                                  const value = entry.values[index];

                                  return value === null || value === undefined ? '' : chart.formatY(value);
                              })
                          ]
                      }
                  ]
        );

    const classes = tableClasses(shown);

    return createPortal(
        <div ref={ref} className={clsx('flex flex-col items-start gap-2', className)}>
            {toggle && (
                <Button size="sm" aria-expanded={shown} aria-controls={id} onClick={() => setShown(!shown)}>
                    {shown ? t('values.hide') : t('values.show')}
                </Button>
            )}
            <div id={id} className={classes.box}>
                <table className={classes.table}>
                    <caption className="sr-only">{t('values.caption', { label: chart.label })}</caption>
                    <thead className={classes.head}>
                        <tr>
                            {grouped && <td />}
                            <td />
                            {columns.map((column, index) => (
                                <th key={index} scope="col" className={classes.column}>
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.key} className={classes.row}>
                                {grouped && <td className={shown ? 'h-8 px-2 text-text-muted' : undefined}>{row.group}</td>}
                                <th scope="row" className={classes.rowHeading}>
                                    {row.label}
                                </th>
                                {row.cells.map((value, index) => (
                                    <td key={index} className={classes.cell}>
                                        {value}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>,
        chart.elements.table
    );
}
