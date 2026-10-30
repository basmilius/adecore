import { useId, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button, Surface } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { colorOf } from './color.ts';
import { createHeatmapCursor, type HeatmapCursor } from './heat-cursor.ts';
import { FLOOR, heatMix, heatShare, moveCell, type HeatCell } from './heat.ts';
import type { ChartColor } from './types.ts';
import { tableClasses } from './values-table.ts';

export type HeatmapCell = HeatCell;

/* A row or a column of a heatmap. */
export interface HeatmapAxisItem {
    readonly key: string | number;
    /* What the tooltip, the live region and the table call it, such as "Monday" or "09:00". */
    readonly label: string;
    /* What the axis writes, such as "Mon"; `null` leaves the axis blank there, as for every hour but each sixth. */
    readonly short?: string | null;
}

export interface HeatmapProps {
    readonly rows: readonly HeatmapAxisItem[];
    readonly columns: readonly HeatmapAxisItem[];
    /* By row, then by column. A missing value (`null`) and a value of zero or less draw an empty cell. */
    readonly values: readonly (readonly (number | null)[])[];
    /* The name of the heatmap, for a screen reader and the table of values. */
    readonly label: string;
    /* What a value counts, such as "Events", in the tooltip, the live region and the table. */
    readonly valueLabel: string;
    readonly tone?: ChartColor;
    /* How many shades the values fall into, besides the empty cell; without it the shade follows the value. */
    readonly steps?: number;
    /* The value of the darkest shade; the highest value by default. A shared `max` lets two heatmaps compare. */
    readonly max?: number;
    readonly format?: (value: number) => string;
    /* In pixels; the width of a cell follows the container. */
    readonly cellHeight?: number;
    readonly legend?: boolean;
    /* Adds a "Show values" toggle; without it the table is there for a screen reader only. */
    readonly table?: boolean;
    /* The cell under the pointer or the keyboard, by index into `rows` and `columns`; null when it leaves the grid. */
    readonly onActiveChange?: (cell: HeatmapCell | null) => void;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/* Between a cell and the card beside it. */
const OFFSET = 8;

// The React Compiler cannot compile optional chaining inside a condition, so the comparison lives out here.
const sameCell = (one: HeatCell | null, other: HeatCell | null): boolean =>
    one === null || other === null ? one === other : one.row === other.row && one.column === other.column;

const shade = (color: string, share: number): string | undefined => (share === 0 ? undefined : `color-mix(in srgb, ${color} ${share}%, transparent)`);

/* The card hangs toward the side of the grid with the most room, so it covers neither the cell nor the edge. */
const cardPlace = (toRight: boolean, down: boolean): CSSProperties => ({
    left: toRight ? `calc(100% + ${OFFSET}px)` : undefined,
    right: toRight ? undefined : `calc(100% + ${OFFSET}px)`,
    top: down ? 0 : undefined,
    bottom: down ? undefined : 0
});

interface HeatmapGridProps extends Pick<HeatmapProps, 'rows' | 'columns' | 'values' | 'valueLabel'> {
    readonly cursor: HeatmapCursor;
    readonly color: string;
    readonly top: number;
    readonly steps: number | undefined;
    readonly cellHeight: number;
    readonly write: (value: number | null) => string;
    readonly onHover: (cell: HeatCell) => void;
}

interface HeatmapCellProps extends Pick<HeatmapGridProps, 'cursor' | 'color' | 'top' | 'steps' | 'cellHeight' | 'valueLabel' | 'write' | 'onHover'> {
    readonly row: number;
    readonly column: number;
    readonly value: number | null;
    readonly rowLabel: string;
    readonly columnLabel: string;
    readonly toRight: boolean;
    readonly down: boolean;
}

function HeatmapCellView({
    cursor,
    color,
    top,
    steps,
    cellHeight,
    valueLabel,
    write,
    onHover,
    row,
    column,
    rowLabel,
    columnLabel,
    toRight,
    down,
    value
}: HeatmapCellProps) {
    const cell = { row, column };
    const subscribe = (listener: () => void): (() => void) => cursor.subscribeCell(cell, listener);
    const selected = (): boolean => cursor.isActive(cell);
    const active = useSyncExternalStore(subscribe, selected, selected);
    const mix = heatMix(value, top, steps);

    return (
        <span
            data-mix={mix}
            className={clsx('rounded-xs', mix === 0 && 'bg-surface-sunken', active && 'relative z-10 outline-1 outline-offset-1 outline-text')}
            style={{ height: cellHeight, backgroundColor: shade(color, mix) }}
            onPointerEnter={() => onHover(cell)}
        >
            {active && (
                <Surface
                    className="pointer-events-none absolute flex w-max min-w-36 flex-col gap-1 rounded-lg px-2.5 py-2 text-xs"
                    style={cardPlace(toRight, down)}
                >
                    <p className="font-medium whitespace-nowrap text-text">
                        {rowLabel} · {columnLabel}
                    </p>
                    <p className="flex items-center gap-2 text-text-muted">
                        <span className={clsx('size-2 shrink-0 rounded-xs', mix === 0 && 'bg-surface-sunken')} style={{ backgroundColor: shade(color, mix) }} />
                        <span className="min-w-0 truncate">{valueLabel}</span>
                        <span className="ml-auto pl-3 text-text tabular-nums">{write(value)}</span>
                    </p>
                </Surface>
            )}
        </span>
    );
}

function HeatmapGrid({ rows, columns, values, valueLabel, cursor, color, top, steps, cellHeight, write, onHover }: HeatmapGridProps) {
    return (
        <div aria-hidden className="grid gap-0.5 text-xs text-text-muted" style={{ gridTemplateColumns: `auto repeat(${columns.length}, minmax(0, 1fr))` }}>
            <span />
            {columns.map((column) => (
                <span key={column.key} className="flex justify-center leading-4 whitespace-nowrap tabular-nums">
                    {column.short === undefined ? column.label : column.short}
                </span>
            ))}
            {rows.map((row, rowIndex) => (
                <div key={row.key} className="contents">
                    <span className="flex items-center pr-2 leading-4 whitespace-nowrap">{row.short === undefined ? row.label : row.short}</span>
                    {columns.map((column, columnIndex) => (
                        <HeatmapCellView
                            key={column.key}
                            cursor={cursor}
                            row={rowIndex}
                            column={columnIndex}
                            rowLabel={row.label}
                            columnLabel={column.label}
                            value={values[rowIndex]?.[columnIndex] ?? null}
                            color={color}
                            top={top}
                            steps={steps}
                            cellHeight={cellHeight}
                            valueLabel={valueLabel}
                            write={write}
                            onHover={onHover}
                            toRight={columnIndex < columns.length / 2}
                            down={rowIndex < rows.length / 2}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

/* A grid of rows by columns, each cell shaded by its value, such as events per weekday and hour. */
export function Heatmap({
    rows,
    columns,
    values,
    label,
    valueLabel,
    tone = 'accent',
    steps,
    max,
    format = formatNumber,
    cellHeight = 16,
    legend = true,
    table = false,
    onActiveChange,
    className,
    ref
}: HeatmapProps) {
    const { t } = useTranslation('charts');
    const id = useId();
    const [cursor] = useState(createHeatmapCursor);
    const active = useSyncExternalStore(cursor.subscribe, cursor.getSnapshot, cursor.getSnapshot);
    const [announce, setAnnounce] = useState(false);
    const [shown, setShown] = useState(false);

    const color = colorOf(tone)!;

    const valueAt = (row: number, column: number): number | null => values[row]?.[column] ?? null;

    const top = max ?? Math.max(0, ...values.flatMap((line) => line.filter((value): value is number => value !== null && Number.isFinite(value))));
    const empty = rows.length === 0 || columns.length === 0;

    const write = (value: number | null): string => (value === null ? t('noData') : format(value));

    const describe = (cell: HeatCell): string => {
        const value = valueAt(cell.row, cell.column);

        return `${rows[cell.row]!.label}, ${columns[cell.column]!.label}, ${value === null ? t('noData') : `${valueLabel} ${format(value)}`}`;
    };

    const current = active !== null && active.row < rows.length && active.column < columns.length ? active : null;
    const classes = tableClasses(table && shown);

    const activate = (cell: HeatCell | null): void => {
        const previous = cursor.getSnapshot();
        const before = previous !== null && previous.row < rows.length && previous.column < columns.length ? previous : null;
        cursor.set(cell);

        if (!sameCell(cell, before)) {
            onActiveChange?.(cell);
        }
    };

    const hover = (cell: HeatCell): void => {
        setAnnounce(false);
        activate(cell);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        const target = moveCell(e.key, current, rows.length, columns.length, e.ctrlKey || e.metaKey);

        if (target === undefined) {
            return;
        }

        e.preventDefault();
        setAnnounce(target !== null);
        activate(target);
    };

    return (
        <div ref={ref} className={clsx('flex min-w-0 flex-col gap-2', className)}>
            <div
                role="group"
                tabIndex={0}
                aria-roledescription={t('heatmap.name')}
                aria-label={label}
                aria-describedby={`${id}-hint`}
                className="focus-ring rounded-xs"
                onKeyDown={onKeyDown}
                onPointerLeave={() => activate(null)}
                onBlur={() => {
                    activate(null);
                    setAnnounce(false);
                }}
            >
                {empty ? (
                    <p className="py-6 text-center text-xs text-text-faint">{t('noData')}</p>
                ) : (
                    <HeatmapGrid
                        rows={rows}
                        columns={columns}
                        values={values}
                        valueLabel={valueLabel}
                        cursor={cursor}
                        color={color}
                        top={top}
                        steps={steps}
                        cellHeight={cellHeight}
                        write={write}
                        onHover={hover}
                    />
                )}
            </div>
            {legend && !empty && (
                <div aria-hidden className="flex items-center justify-end gap-1 text-xs text-text-muted">
                    <span className="mr-1">{t('heatmap.less')}</span>
                    {steps === undefined ? (
                        <>
                            <span className="size-3 rounded-xs bg-surface-sunken" />
                            <span
                                data-legend="gradient"
                                className="h-3 w-16 rounded-xs"
                                style={{ backgroundImage: `linear-gradient(to right, ${shade(color, FLOOR)}, ${shade(color, 100)})` }}
                            />
                        </>
                    ) : (
                        Array.from({ length: steps + 1 }, (_, step) => (
                            <span
                                key={step}
                                className={clsx('size-3 rounded-xs', step === 0 && 'bg-surface-sunken')}
                                style={{ backgroundColor: shade(color, heatShare(step, steps)) }}
                            />
                        ))
                    )}
                    <span className="ml-1">{t('heatmap.more')}</span>
                </div>
            )}
            {!empty && (
                <div className={table ? 'flex flex-col items-start gap-2' : undefined}>
                    {table && (
                        <Button size="sm" aria-expanded={shown} aria-controls={`${id}-table`} onClick={() => setShown((open) => !open)}>
                            {shown ? t('values.hide') : t('values.show')}
                        </Button>
                    )}
                    <div id={`${id}-table`} className={classes.box}>
                        <table className={classes.table}>
                            <caption className="sr-only">{t('values.caption', { label })}</caption>
                            <thead className={classes.head}>
                                <tr>
                                    <td />
                                    {columns.map((column) => (
                                        <th key={column.key} scope="col" className={classes.column}>
                                            {column.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rowIndex) => (
                                    <tr key={row.key} className={classes.row}>
                                        <th scope="row" className={classes.rowHeading}>
                                            {row.label}
                                        </th>
                                        {columns.map((column, columnIndex) => {
                                            const value = valueAt(rowIndex, columnIndex);

                                            return (
                                                <td key={column.key} className={classes.cell}>
                                                    {value === null ? '' : format(value)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <p id={`${id}-hint`} className="sr-only">
                {t('heatmap.keyboard')}
            </p>
            <p aria-live="polite" className="sr-only">
                {announce && current !== null ? describe(current) : ''}
            </p>
        </div>
    );
}
