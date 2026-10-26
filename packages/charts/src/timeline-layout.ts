import type { ChartColor } from './types.ts';

/* A span of a trace: a stretch of time, under the span it was part of. */
export interface TimelineSpan {
    readonly id: string;
    /* Null, or an id that is not in the data, makes the span a root. */
    readonly parent?: string | null;
    /* The name a screen reader reads, and what the row shows without a `label` of `Timeline.Rows`. */
    readonly label: string;
    /* In milliseconds, on the same clock as every other span and moment. */
    readonly start: number;
    /* In milliseconds. */
    readonly duration: number;
    /* The id of one of the kinds of the root, which colors the bar and counts in the legend. */
    readonly kind?: string;
    /* Stands in for the color of its kind, such as `'error'` for a span that failed. */
    readonly tone?: ChartColor;
}

/* What a span waits on, such as the database or the network. Without a tone, the kinds take the chart colors in order. */
export interface TimelineKind {
    readonly id: string;
    readonly label: string;
    readonly tone?: ChartColor;
}

export interface TimelineTreeRow<Span> {
    readonly span: Span;
    readonly depth: number;
    /* The number of spans directly under this one. */
    readonly children: number;
    /* The ids of the spans this one hangs under, the root first; a folded one hides it. */
    readonly ancestors: readonly string[];
    /* The place of the span among its siblings, from 1, and how many siblings there are. */
    readonly position: number;
    readonly siblings: number;
}

const byStart = <Span extends TimelineSpan>(first: Span, second: Span): number => first.start - second.start;

/* The spans in the order of the tree, each after its parent and its siblings by start. */
export function timelineTree<Span extends TimelineSpan>(spans: readonly Span[]): TimelineTreeRow<Span>[] {
    const known = new Set(spans.map((span) => span.id));
    const children = new Map<string | null, Span[]>();

    for (const span of spans) {
        const parent = span.parent !== undefined && span.parent !== null && span.parent !== span.id && known.has(span.parent) ? span.parent : null;
        const siblings = children.get(parent);

        if (siblings === undefined) {
            children.set(parent, [span]);
        } else {
            siblings.push(span);
        }
    }

    const rows: TimelineTreeRow<Span>[] = [];
    const placed = new Set<string>();

    const visit = (siblings: readonly Span[], ancestors: readonly string[]): void => {
        const sorted = siblings.filter((span) => !placed.has(span.id)).toSorted(byStart);

        sorted.forEach((span, index) => {
            placed.add(span.id);
            const own = (children.get(span.id) ?? []).filter((child) => !placed.has(child.id));
            rows.push({ span, depth: ancestors.length, children: own.length, ancestors, position: index + 1, siblings: sorted.length });
            visit(own, [...ancestors, span.id]);
        });
    };

    visit(children.get(null) ?? [], []);

    // Spans of a parent cycle reach no root; each that is left starts a tree of its own.
    for (const span of spans.toSorted(byStart)) {
        if (!placed.has(span.id)) {
            visit([span], []);
        }
    }

    return rows;
}

/* The rows whose every ancestor is open. */
export function visibleRows<Row extends { readonly ancestors: readonly string[] }>(rows: readonly Row[], expanded: ReadonlySet<string>): Row[] {
    return rows.filter((row) => row.ancestors.every((id) => expanded.has(id)));
}

/* The ids of every span with children, which is what is open before a person folds anything. */
export function parentIds(rows: readonly TimelineTreeRow<TimelineSpan>[]): string[] {
    return rows.flatMap((row) => (row.children > 0 ? [row.span.id] : []));
}

/* The earliest start and the time from there to the latest end or `fixedEnd`; never zero, so a trace of one instant still has an axis. */
export function timelineExtent(spans: readonly TimelineSpan[], fixedEnd?: number): { readonly origin: number; readonly total: number } {
    if (spans.length === 0) {
        return { origin: 0, total: 1 };
    }

    const origin = Math.min(...spans.map((span) => span.start));
    const end = fixedEnd ?? Math.max(...spans.map((span) => span.start + span.duration));

    return { origin, total: Math.max(end - origin, 0.001) };
}

/*
 * Round steps of 1, 2 or 5 from zero to `total`: the smallest step that gives at most `count` intervals, so a
 * trace of 340 ms gets 0, 100, 200 and 300 ms.
 */
export function durationTicks(total: number, count = 5): number[] {
    if (!(total > 0) || !(count > 0)) {
        return [0];
    }

    const raw = total / count;
    const power = 10 ** Math.floor(Math.log10(Math.max(raw, 0.001)));
    const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw) ?? raw;
    const ticks: number[] = [];

    // Counted, not summed, so 0.1 + 0.2 never drifts past the end.
    for (let i = 0; i * step <= total + step * 1e-9; i++) {
        ticks.push(Number((i * step).toPrecision(12)));
    }

    return ticks;
}

export interface TimelineBar {
    /* Both in percent of the axis. */
    readonly left: number;
    readonly width: number;
    /* Where the duration goes: in a bar wide enough, else on the side with room. */
    readonly label: 'inside' | 'before' | 'after';
}

/* A bar is never thinner than this share of the axis, so a span of an instant still shows. */
const MIN_WIDTH = 0.3;
const INSIDE_FROM = 14;
const BEFORE_FROM = 80;

/* A moment in percent of the axis, held inside it. */
export function percentOf(at: number, origin: number, total: number): number {
    return Math.min(100, Math.max(0, ((at - origin) / total) * 100));
}

export function barOf(span: TimelineSpan, origin: number, total: number): TimelineBar {
    const left = Math.min(percentOf(span.start, origin, total), 100 - MIN_WIDTH);
    // A span that runs past a fixed end is cut off there.
    const width = Math.max(MIN_WIDTH, Math.min((span.duration / total) * 100, 100 - left));

    return { left, width, label: width > INSIDE_FROM ? 'inside' : left + width > BEFORE_FROM ? 'before' : 'after' };
}

/* The time the spans of each kind take, the roots left out: a root covers the whole trace and would outweigh every kind. */
export function kindTimes(rows: readonly TimelineTreeRow<TimelineSpan>[]): Map<string, number> {
    const times = new Map<string, number>();

    for (const { span, depth } of rows) {
        if (depth > 0 && span.kind !== undefined) {
            times.set(span.kind, (times.get(span.kind) ?? 0) + span.duration);
        }
    }

    return times;
}

export type TimelineMove = { readonly focus: number } | { readonly expand: string } | { readonly collapse: string } | { readonly select: string };

/*
 * What a key does in the tree of rows, as in a tree view: Up and Down step, Home and End go to the ends, Right
 * opens a folded row or moves into an open one, Left folds an open row or moves to its parent, Enter and Space
 * select. `undefined` leaves the key to the page.
 */
export function timelineMove(
    key: string,
    rows: readonly TimelineTreeRow<TimelineSpan>[],
    current: number,
    expanded: ReadonlySet<string>
): TimelineMove | undefined {
    const row = rows[current];

    if (row === undefined) {
        return undefined;
    }

    switch (key) {
        case 'ArrowDown':
            return { focus: Math.min(rows.length - 1, current + 1) };
        case 'ArrowUp':
            return { focus: Math.max(0, current - 1) };
        case 'Home':
            return { focus: 0 };
        case 'End':
            return { focus: rows.length - 1 };
        case 'ArrowRight':
            if (row.children === 0) {
                return undefined;
            }

            return expanded.has(row.span.id) ? { focus: current + 1 } : { expand: row.span.id };
        case 'ArrowLeft': {
            if (row.children > 0 && expanded.has(row.span.id)) {
                return { collapse: row.span.id };
            }

            const parent = row.ancestors.at(-1);
            const index = parent === undefined ? -1 : rows.findIndex((candidate) => candidate.span.id === parent);

            return index < 0 ? undefined : { focus: index };
        }
        case 'Enter':
        case ' ':
            return { select: row.span.id };
        default:
            return undefined;
    }
}
