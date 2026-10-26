import { createContext, useContext, useId, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Tooltip, Tree } from '@adecore/ui';
import { formatNumber, formatPreciseDuration } from '@adecore/ui/format';
import { colorOf, seriesColor } from './color.ts';
import {
    barOf,
    durationTicks,
    kindTimes,
    parentIds,
    percentOf,
    timelineExtent,
    timelineMove,
    timelineTree,
    visibleRows,
    type TimelineKind,
    type TimelineSpan,
    type TimelineTreeRow
} from './timeline-layout.ts';
import type { ChartColor } from './types.ts';

export interface TimelineRootProps<Span extends TimelineSpan> {
    readonly data: readonly Span[];
    readonly kinds?: readonly TimelineKind[];
    /* The name of the tree of rows, for a screen reader. */
    readonly label: string;
    /* The id of the selected span, which shows its detail; null for none. */
    readonly value?: string | null;
    readonly defaultValue?: string | null;
    readonly onValueChange?: (value: string | null) => void;
    /* The ids of the spans that show their children; every span with children by default. */
    readonly expanded?: readonly string[];
    readonly defaultExpanded?: readonly string[];
    readonly onExpandedChange?: (expanded: string[]) => void;
    /* Writes a duration in milliseconds, on the axis, the bars, the legend and the names of the rows. */
    readonly format?: (ms: number) => string;
    /* A target count of ticks on the axis. */
    readonly ticks?: number;
    /* Where the axis ends, on the clock of the spans, such as the end of the root; a span past it is cut off. */
    readonly end?: number;
    readonly children?: ReactNode;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/* What a row is in the tree, as `Timeline.Rows` hands it to its `label`. */
export interface TimelineRowState {
    readonly depth: number;
    /* The number of spans directly under this one. */
    readonly children: number;
    readonly expanded: boolean;
    /* The CSS color of its bar. */
    readonly color: string;
}

export interface TimelineRowsProps<Span extends TimelineSpan> {
    /* What a row shows after its swatch; the span's `label` by default. */
    readonly label?: (span: Span, row: TimelineRowState) => ReactNode;
    /* What the selected row shows under it. */
    readonly detail?: (span: Span) => ReactNode;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

export interface TimelineLegendProps {
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

export interface TimelineAxisProps {
    /* Over the labels of the rows, such as "Span". */
    readonly heading?: ReactNode;
    /* The `Timeline.Moment`s on the axis. */
    readonly children?: ReactNode;
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

export interface TimelineMomentProps {
    /* In milliseconds, on the clock of the spans. */
    readonly at: number;
    readonly label: string;
    readonly tone?: ChartColor;
}

interface TimelineContextValue {
    readonly label: string;
    readonly rows: readonly TimelineTreeRow<TimelineSpan>[];
    readonly origin: number;
    readonly total: number;
    readonly ticks: readonly number[];
    readonly kinds: readonly TimelineKind[];
    readonly colorOfKind: (kind: string | undefined) => string;
    readonly expanded: ReadonlySet<string>;
    readonly setExpanded: (id: string, open: boolean) => void;
    readonly value: string | null;
    readonly select: (id: string) => void;
    readonly format: (ms: number) => string;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

const useTimeline = (part: string): TimelineContextValue => {
    const context = useContext(TimelineContext);

    if (context === null) {
        throw new Error(`${part} draws inside a Timeline.Root.`);
    }

    return context;
};

/* Two columns, the labels and the bars, from the width a row of both needs; one above the other below it. */
const COLUMNS = 'grid grid-cols-1 @xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]';
/* Deeper rows keep the guides of the eighth level, so a deep tree still leaves room for its labels. */
const MAX_GUIDES = 8;

/* The spans of a trace on one axis of time: a tree of rows that folds, each with its bar, and the details of the selected one. */
export function TimelineRoot<Span extends TimelineSpan>({
    data,
    kinds = [],
    label,
    value: valueProp,
    defaultValue = null,
    onValueChange,
    expanded: expandedProp,
    defaultExpanded,
    onExpandedChange,
    format = formatPreciseDuration,
    ticks: tickTarget = 5,
    end,
    children,
    className,
    ref
}: TimelineRootProps<Span>) {
    const rows = timelineTree(data);
    const parents = parentIds(rows);

    // Uncontrolled, the root keeps what was folded rather than what is open, so a span that arrives later opens.
    const [folded, setFolded] = useState<ReadonlySet<string>>(() =>
        defaultExpanded === undefined ? new Set() : new Set(parents.filter((id) => !defaultExpanded.includes(id)))
    );

    const [ownValue, setOwnValue] = useState<string | null>(defaultValue);
    const expanded = new Set(expandedProp ?? parents.filter((id) => !folded.has(id)));
    const value = valueProp === undefined ? ownValue : valueProp;
    const { origin, total } = timelineExtent(data, end);
    const kindIndex = new Map(kinds.map((kind, index) => [kind.id, index]));

    const colorOfKind = (kind: string | undefined): string => {
        const index = kind === undefined ? undefined : kindIndex.get(kind);

        if (index === undefined) {
            return colorOf('accent')!;
        }

        return colorOf(kinds[index]!.tone) ?? seriesColor(index);
    };

    const setExpanded = (id: string, open: boolean): void => {
        if (expandedProp === undefined) {
            setFolded((current) => {
                const next = new Set(current);

                if (open) {
                    next.delete(id);
                } else {
                    next.add(id);
                }

                return next;
            });
        }

        onExpandedChange?.(open ? [...expanded, id] : [...expanded].filter((entry) => entry !== id));
    };

    const select = (id: string): void => {
        const next = value === id ? null : id;

        if (valueProp === undefined) {
            setOwnValue(next);
        }

        onValueChange?.(next);
    };

    const context: TimelineContextValue = {
        label,
        rows,
        origin,
        total,
        ticks: durationTicks(total, tickTarget),
        kinds,
        colorOfKind,
        expanded,
        setExpanded,
        value,
        select,
        format
    };

    return (
        <TimelineContext value={context}>
            <div ref={ref} className={clsx('@container flex min-w-0 flex-col', className)}>
                {children}
            </div>
        </TimelineContext>
    );
}

/* Each kind with its color and the time its spans take, without the roots. */
export function TimelineLegend({ className, ref }: TimelineLegendProps) {
    const timeline = useTimeline('Timeline.Legend');
    const times = kindTimes(timeline.rows);
    const shown = timeline.kinds.filter((kind) => (times.get(kind.id) ?? 0) > 0);

    if (shown.length === 0) {
        return null;
    }

    return (
        <div ref={ref} className={clsx('flex flex-wrap gap-x-4 gap-y-1 border-b border-border-soft px-4 py-2.5 text-xs text-text-muted', className)}>
            {shown.map((kind) => (
                <span key={kind.id} className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-xs" style={{ background: timeline.colorOfKind(kind.id) }} />
                    {kind.label}
                    <span className="text-text tabular-nums">{timeline.format(times.get(kind.id)!)}</span>
                </span>
            ))}
        </div>
    );
}

/* The heading over the labels and the ticks over the bars, with the moments on it. */
export function TimelineAxis({ heading, children, className, ref }: TimelineAxisProps) {
    const timeline = useTimeline('Timeline.Axis');
    const { origin, total, ticks } = timeline;

    return (
        <div ref={ref} className={clsx(COLUMNS, className)}>
            <div className="hidden border-b border-border-soft px-4 py-2 text-xs text-text-muted @xl:block">{heading}</div>
            <div className="relative mx-4 h-8 border-b border-border-soft @xl:ml-0">
                {ticks.map((tick, index) => {
                    const left = percentOf(origin + tick, origin, total);

                    // The first label starts at its tick and one near the end ends at it, so neither hangs past the axis.
                    return (
                        <span
                            key={tick}
                            aria-hidden
                            className={clsx(
                                'absolute bottom-1.5 text-xs whitespace-nowrap text-text-muted tabular-nums',
                                index === 0 ? undefined : left > 92 ? '-translate-x-full' : '-translate-x-1/2'
                            )}
                            style={{ left: `${left}%` }}
                        >
                            {timeline.format(tick)}
                        </span>
                    );
                })}
                {children}
            </div>
        </div>
    );
}

/* A diamond on the axis at a moment, such as an error, named in a tooltip with its offset from the start. */
export function TimelineMoment({ at, label, tone = 'error' }: TimelineMomentProps) {
    const timeline = useTimeline('Timeline.Moment');
    const { t } = useTranslation('charts');
    const text = t('timeline.moment', { label, offset: timeline.format(Math.max(0, at - timeline.origin)) });

    return (
        <Tooltip label={text} name>
            <span
                role="img"
                tabIndex={0}
                className="focus-ring absolute top-1 size-2 -translate-x-1/2 rotate-45"
                style={{ left: `${percentOf(at, timeline.origin, timeline.total)}%`, background: colorOf(tone)! }}
            />
        </Tooltip>
    );
}

/* A row per visible span, one stop for the keyboard that moves through them as a tree. */
export function TimelineRows<Span extends TimelineSpan>({ label, detail, className, ref }: TimelineRowsProps<Span>) {
    const timeline = useTimeline('Timeline.Rows');
    const { t } = useTranslation('charts');
    const id = useId();
    const [focusId, setFocusId] = useState<string | null>(null);
    const { rows, expanded, origin, total, ticks, format } = timeline;
    const shown = visibleRows(rows, expanded);

    // The row that takes the tab stop: the one last focused, or the open row that hides it, else the selected or the first.
    const indexOf = (target: string | null): number => shown.findIndex((row) => row.span.id === target);

    let current = indexOf(focusId);

    if (current < 0 && focusId !== null) {
        const hidden = rows.find((row) => row.span.id === focusId);
        const ancestor = hidden?.ancestors.find((ancestorId) => !expanded.has(ancestorId));
        current = indexOf(ancestor ?? null);
    }

    if (current < 0) {
        current = Math.max(0, indexOf(timeline.value));
    }

    const focusRow = (box: HTMLElement, index: number): void => {
        const target = shown[index];

        if (target === undefined) {
            return;
        }

        setFocusId(target.span.id);
        const node = [...box.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((item) => item.dataset.span === target.span.id);
        node?.focus();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        // Keys inside a row's detail, such as in a field or a link, belong to it.
        if ((e.target as HTMLElement).getAttribute('role') !== 'treeitem') {
            return;
        }

        const move = timelineMove(e.key, shown, current, expanded);

        if (move === undefined) {
            return;
        }

        e.preventDefault();

        if ('focus' in move) {
            focusRow(e.currentTarget, move.focus);
        } else if ('expand' in move) {
            timeline.setExpanded(move.expand, true);
        } else if ('collapse' in move) {
            timeline.setExpanded(move.collapse, false);
        } else {
            timeline.select(move.select);
        }
    };

    if (rows.length === 0) {
        return (
            <div ref={ref} className={clsx('px-4 py-3 text-xs text-text-faint', className)}>
                {t('noData')}
            </div>
        );
    }

    return (
        <>
            <div
                ref={ref}
                role="tree"
                aria-label={timeline.label}
                aria-describedby={`${id}-hint`}
                className={clsx('flex flex-col', className)}
                onKeyDown={onKeyDown}
            >
                {shown.map((row, index) => {
                    const { span } = row;
                    const open = expanded.has(span.id);
                    const selected = timeline.value === span.id;
                    const color = colorOf(span.tone) ?? timeline.colorOfKind(span.kind);
                    const bar = barOf(span, origin, total);
                    const kind = timeline.kinds.find((entry) => entry.id === span.kind);

                    const name = [
                        span.label,
                        kind?.label,
                        t('timeline.start', { offset: format(Math.max(0, span.start - origin)) }),
                        t('timeline.duration', { duration: format(span.duration) })
                    ]
                        .filter(Boolean)
                        .join(', ');

                    const detailId = `${id}-${index}-detail`;
                    const shownDetail = selected && detail !== undefined;

                    return (
                        <div
                            key={span.id}
                            role="treeitem"
                            data-span={span.id}
                            tabIndex={index === current ? 0 : -1}
                            aria-label={name}
                            aria-level={row.depth + 1}
                            aria-posinset={row.position}
                            aria-setsize={row.siblings}
                            aria-expanded={row.children > 0 ? open : undefined}
                            aria-selected={selected}
                            aria-describedby={shownDetail ? detailId : undefined}
                            className={clsx(
                                COLUMNS,
                                'cursor-default outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
                                selected ? 'bg-surface-active' : 'hover:bg-surface-hover'
                            )}
                            onFocus={(e) => {
                                if (e.target === e.currentTarget) {
                                    setFocusId(span.id);
                                }
                            }}
                            onClick={() => {
                                setFocusId(span.id);
                                timeline.select(span.id);
                            }}
                        >
                            <div className="flex min-w-0 items-center gap-1.5 px-4 pt-1 @xl:py-1">
                                <span aria-hidden className="flex shrink-0 self-stretch">
                                    {Array.from({ length: Math.min(row.depth, MAX_GUIDES) }, (_, level) => (
                                        <span key={level} className="w-3 border-l border-border-soft" />
                                    ))}
                                </span>
                                {row.children > 0 ? (
                                    <Tree.Chevron
                                        expanded={open}
                                        onExpandedChange={(next) => timeline.setExpanded(span.id, next)}
                                        className="rounded-xs text-text-muted hover:bg-surface-active"
                                    />
                                ) : (
                                    <span className="size-4 shrink-0" />
                                )}
                                <span aria-hidden className="size-2 shrink-0 rounded-xs" style={{ background: color }} />
                                {label === undefined ? (
                                    <span className="min-w-0 truncate text-xs text-text">{span.label}</span>
                                ) : (
                                    label(span as Span, { depth: row.depth, children: row.children, expanded: open, color })
                                )}
                                {row.children > 0 && !open && (
                                    <span className="shrink-0 text-xs text-text-muted tabular-nums">+{formatNumber(row.children)}</span>
                                )}
                            </div>
                            <div aria-hidden className="relative mx-4 mb-1 h-5 @xl:mb-0 @xl:ml-0 @xl:h-7">
                                {ticks.map((tick) => (
                                    <span
                                        key={tick}
                                        className="absolute inset-y-0 w-px bg-border-soft"
                                        style={{ left: `${percentOf(origin + tick, origin, total)}%` }}
                                    />
                                ))}
                                <span
                                    className="absolute inset-y-0.5 flex items-center overflow-hidden rounded-xs border-l-2 px-1.5 @xl:inset-y-1"
                                    style={{
                                        left: `${bar.left}%`,
                                        width: `${bar.width}%`,
                                        borderColor: color,
                                        background: `color-mix(in srgb, ${color} 22%, transparent)`
                                    }}
                                >
                                    {bar.label === 'inside' && <span className="truncate text-xs text-text tabular-nums">{format(span.duration)}</span>}
                                </span>
                                {bar.label !== 'inside' && (
                                    <span
                                        className="absolute inset-y-0 flex items-center px-1.5 text-xs whitespace-nowrap text-text-muted tabular-nums"
                                        style={bar.label === 'after' ? { left: `${bar.left + bar.width}%` } : { right: `${100 - bar.left}%` }}
                                    >
                                        {format(span.duration)}
                                    </span>
                                )}
                            </div>
                            {shownDetail && (
                                // A press inside the detail, such as on a link or to select its text, does not unselect the row.
                                // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                <div
                                    id={detailId}
                                    className="col-span-full cursor-auto border-y border-border-soft bg-surface-sunken px-4 py-3"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {detail(span as Span)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <p id={`${id}-hint`} className="sr-only">
                {t('timeline.keyboard')}
            </p>
        </>
    );
}
