import { describe, expect, test } from 'bun:test';
import {
    clampColumnWidth,
    columnOffsets,
    estimateColumnWidth,
    fitColumnWidth,
    isDoubleClick,
    MAX_FIT_WIDTH,
    gutterWidth,
    MAX_COLUMN_WIDTH,
    MIN_COLUMN_WIDTH,
    scrollToReveal,
    visibleRange
} from './layout.ts';

describe('visibleRange', () => {
    test('draws the rows in view plus the overscan on both sides', () => {
        expect(visibleRange(280, 280, 28, 1000, 2)).toEqual({ start: 8, end: 22 });
    });

    test('stops at the first and the last row', () => {
        expect(visibleRange(-100, 140, 28, 1000, 3)).toEqual({ start: 0, end: 5 });
        expect(visibleRange(27_900, 600, 28, 1000, 3)).toEqual({ start: 993, end: 1000 });
    });

    test('draws nothing without rows or without a viewport', () => {
        expect(visibleRange(0, 600, 28, 0, 3)).toEqual({ start: 0, end: 0 });
        expect(visibleRange(0, 0, 28, 100, 3)).toEqual({ start: 0, end: 0 });
    });

    test('keeps a window past the end empty of rows that do not exist', () => {
        const range = visibleRange(50_000, 600, 28, 10, 2);
        expect(range.end).toBe(10);
        expect(range.start).toBeLessThanOrEqual(range.end);
    });
});

describe('scrollToReveal', () => {
    test('leaves the scroll alone when the item is in view', () => {
        expect(scrollToReveal(200, 28, 100, 400, 32)).toBe(100);
    });

    test('scrolls up until the item clears the sticky header', () => {
        expect(scrollToReveal(120, 28, 100, 400, 32)).toBe(88);
    });

    test('scrolls down until the item ends at the bottom edge', () => {
        expect(scrollToReveal(480, 28, 100, 400, 32)).toBe(108);
    });

    test('never scrolls before the start', () => {
        expect(scrollToReveal(10, 28, 100, 400, 32)).toBe(0);
    });
});

describe('column widths', () => {
    test('offsets are the running sum of the widths before a column', () => {
        expect(columnOffsets([100, 80, 64])).toEqual([0, 100, 180]);
    });

    test('an estimate is whole pixels between the minimum and the maximum', () => {
        expect(estimateColumnWidth('id', ['1', '2'], false)).toBe(MIN_COLUMN_WIDTH);
        expect(estimateColumnWidth('note', ['x'.repeat(500)], false)).toBe(MAX_COLUMN_WIDTH);
        const width = estimateColumnWidth('email', ['someone@example.com'], false);
        expect(Number.isInteger(width)).toBe(true);
        expect(width).toBeGreaterThan(MIN_COLUMN_WIDTH);
    });

    test('the header sets the width when the values are shorter', () => {
        expect(estimateColumnWidth('terms_accepted_at', ['1'], false)).toBeGreaterThan(estimateColumnWidth('terms', ['1'], false));
    });

    test('a key icon takes room before the name', () => {
        expect(estimateColumnWidth('merchant_identifier', [], true)).toBeGreaterThan(estimateColumnWidth('merchant_identifier', [], false));
    });

    test('a clamp rounds up to a whole pixel', () => {
        expect(clampColumnWidth(100.2)).toBe(101);
        expect(clampColumnWidth(10)).toBe(MIN_COLUMN_WIDTH);
    });

    test('the gutter grows with the digits of the largest row number', () => {
        expect(gutterWidth(9)).toBe(40);
        expect(gutterWidth(1_000_000)).toBeGreaterThan(gutterWidth(1000));
    });
});

describe('fitColumnWidth', () => {
    test('fits the longest text, past the 320 an estimate stops at', () => {
        expect(fitColumnWidth('id', ['x'.repeat(50)], false)).toBe(50 * 8 + 24);
    });

    test('never goes past the maximum or below the minimum', () => {
        expect(fitColumnWidth('id', ['x'.repeat(500)], false)).toBe(MAX_FIT_WIDTH);
        expect(fitColumnWidth('i', [], false)).toBe(MIN_COLUMN_WIDTH);
    });

    test('leaves room for the key and the sort arrow beside a long name', () => {
        expect(fitColumnWidth('created_at_long_name', ['1'], true)).toBe(20 * 8 + 18 + 24 + 24);
    });
});

describe('isDoubleClick', () => {
    test('is two presses close together', () => {
        expect(isDoubleClick(1000, 1200)).toBe(true);
        expect(isDoubleClick(1000, 1600)).toBe(false);
        expect(isDoubleClick(null, 1000)).toBe(false);
    });
});
