import { describe, expect, test } from 'bun:test';
import { barOf, durationTicks, kindTimes, timelineExtent, timelineMove, timelineTree, visibleRows, type TimelineSpan } from './timeline-layout.ts';

const SPANS: TimelineSpan[] = [
    { id: 'query', parent: 'request', label: 'SELECT orders', start: 1012, duration: 40, kind: 'db' },
    { id: 'request', parent: null, label: 'GET /orders', start: 1000, duration: 340, kind: 'http' },
    { id: 'render', parent: 'request', label: 'render', start: 1100, duration: 200, kind: 'code' },
    { id: 'partial', parent: 'render', label: 'partial', start: 1150, duration: 30, kind: 'code' },
    { id: 'lost', parent: 'gone', label: 'orphan', start: 1400, duration: 10 }
];

const ids = (rows: readonly { span: TimelineSpan }[]): string[] => rows.map((row) => row.span.id);

describe('timelineTree', () => {
    test('puts every span after its parent, siblings by start, and a span without a known parent at the top', () => {
        const rows = timelineTree(SPANS);
        expect(ids(rows)).toEqual(['request', 'query', 'render', 'partial', 'lost']);
        expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 2, 0]);
        expect(rows[0]!.children).toBe(2);
        expect(rows[3]!.ancestors).toEqual(['request', 'render']);
        expect(rows.map((row) => `${row.position}/${row.siblings}`)).toEqual(['1/2', '1/2', '2/2', '1/1', '2/2']);
    });

    test('draws every span of a parent cycle once', () => {
        const rows = timelineTree([
            { id: 'a', parent: 'b', label: 'a', start: 0, duration: 1 },
            { id: 'b', parent: 'a', label: 'b', start: 1, duration: 1 }
        ]);

        expect(ids(rows)).toEqual(['a', 'b']);
        expect(rows.map((row) => row.depth)).toEqual([0, 1]);
    });
});

test('visibleRows hides every span under a folded one', () => {
    const rows = timelineTree(SPANS);
    expect(ids(visibleRows(rows, new Set(['request'])))).toEqual(['request', 'query', 'render', 'lost']);
    expect(ids(visibleRows(rows, new Set()))).toEqual(['request', 'lost']);
});

test('timelineExtent runs from the earliest start to the latest end', () => {
    expect(timelineExtent(SPANS)).toEqual({ origin: 1000, total: 410 });
    expect(timelineExtent([{ id: 'x', label: 'x', start: 5, duration: 0 }]).total).toBeGreaterThan(0);
});

test('a fixed end ends the axis there, and cuts off a span that runs past it', () => {
    expect(timelineExtent(SPANS, 1340)).toEqual({ origin: 1000, total: 340 });
    expect(barOf({ id: 'past', label: 'past', start: 1170, duration: 400 }, 1000, 340)).toEqual({ left: 50, width: 50, label: 'inside' });
    expect(barOf({ id: 'after', label: 'after', start: 1500, duration: 10 }, 1000, 340).left).toBe(99.7);
});

describe('durationTicks', () => {
    test('takes the smallest round step that gives at most the count', () => {
        expect(durationTicks(340)).toEqual([0, 100, 200, 300]);
        expect(durationTicks(1000)).toEqual([0, 200, 400, 600, 800, 1000]);
        expect(durationTicks(0.9)).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    });

    test('keeps a single tick for an empty axis', () => {
        expect(durationTicks(0)).toEqual([0]);
    });
});

describe('barOf', () => {
    test('writes the duration in a wide bar and beside a narrow one, on the side with room', () => {
        expect(barOf(SPANS[1]!, 1000, 340)).toEqual({ left: 0, width: 100, label: 'inside' });
        expect(barOf(SPANS[0]!, 1000, 340).label).toBe('after');
        expect(barOf({ id: 'late', label: 'late', start: 1320, duration: 20 }, 1000, 340).label).toBe('before');
    });

    test('keeps an instant visible', () => {
        expect(barOf({ id: 'mark', label: 'mark', start: 1000, duration: 0 }, 1000, 340).width).toBe(0.3);
    });
});

test('kindTimes adds up the spans of each kind and leaves the roots out', () => {
    expect(Object.fromEntries(kindTimes(timelineTree(SPANS)))).toEqual({ db: 40, code: 230 });
});

describe('timelineMove', () => {
    const rows = timelineTree(SPANS);
    const open = new Set(['request', 'render']);
    const shown = visibleRows(rows, open);

    test('steps up and down and jumps to the ends', () => {
        expect(timelineMove('ArrowDown', shown, 0, open)).toEqual({ focus: 1 });
        expect(timelineMove('ArrowDown', shown, shown.length - 1, open)).toEqual({ focus: shown.length - 1 });
        expect(timelineMove('ArrowUp', shown, 0, open)).toEqual({ focus: 0 });
        expect(timelineMove('End', shown, 0, open)).toEqual({ focus: shown.length - 1 });
    });

    test('right opens a folded row and moves into an open one', () => {
        expect(timelineMove('ArrowRight', shown, 0, open)).toEqual({ focus: 1 });
        expect(timelineMove('ArrowRight', shown, 0, new Set())).toEqual({ expand: 'request' });
        expect(timelineMove('ArrowRight', shown, 1, open)).toBeUndefined();
    });

    test('left folds an open row and moves from any other to its parent', () => {
        expect(timelineMove('ArrowLeft', shown, 2, open)).toEqual({ collapse: 'render' });
        expect(timelineMove('ArrowLeft', shown, 3, open)).toEqual({ focus: 2 });
        expect(timelineMove('ArrowLeft', shown, 4, open)).toBeUndefined();
    });

    test('Enter and Space select, other keys stay with the page', () => {
        expect(timelineMove('Enter', shown, 1, open)).toEqual({ select: 'query' });
        expect(timelineMove(' ', shown, 1, open)).toEqual({ select: 'query' });
        expect(timelineMove('Tab', shown, 1, open)).toBeUndefined();
    });
});
