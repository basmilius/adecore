import { describe, expect, test } from 'bun:test';
import {
    clampColumnWidth,
    columnOffsets,
    estimateColumnWidth,
    fitColumnWidth,
    isDoubleClick,
    MAX_FIT_WIDTH,
    growWidths,
    gutterWidth,
    MAX_COLUMN_WIDTH,
    MIN_COLUMN_WIDTH,
    scrollToReveal,
    drawnRange,
    ROW_BLOCK,
    ROW_HEIGHT,
    scrollBlock
} from './layout.ts';

describe('drawnRange', () => {
    test('draws the rows in view and a viewport more on each side, in whole blocks', () => {
        const page = Math.ceil(600 / ROW_HEIGHT);
        const range = drawnRange(10, 600, 10_000);
        expect(range.start % ROW_BLOCK).toBe(0);
        expect(range.end % ROW_BLOCK).toBe(0);
        expect(range.start).toBeLessThanOrEqual(10 * ROW_BLOCK - page);
        expect(range.end).toBeGreaterThanOrEqual(11 * ROW_BLOCK + 2 * page);
    });

    test('stays the same while the top moves within a block, and moves by blocks', () => {
        const first = scrollBlock(5 * ROW_BLOCK * ROW_HEIGHT);
        for (let row = 0; row < ROW_BLOCK; row++) {
            expect(scrollBlock((5 * ROW_BLOCK + row) * ROW_HEIGHT)).toBe(first);
        }
        expect(scrollBlock(6 * ROW_BLOCK * ROW_HEIGHT)).toBe(first + 1);
        expect(scrollBlock(-40)).toBe(0);
    });

    test('keeps to the rows there are', () => {
        expect(drawnRange(0, 600, 10)).toEqual({ start: 0, end: 10 });
        expect(drawnRange(500, 600, 10)).toEqual({ start: 10, end: 10 });
        expect(drawnRange(0, 600, 0)).toEqual({ start: 0, end: 0 });
        expect(drawnRange(0, 0, 100)).toEqual({ start: 0, end: 0 });
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

describe('growWidths', () => {
    test('widens a column the next page needs more room for', () => {
        expect(growWidths([100, 120], [100, 180])).toEqual([100, 180]);
    });

    test('never narrows a column', () => {
        expect(growWidths([200, 120], [90, 120])).toEqual([200, 120]);
    });

    test('takes the widths of the next page when there are none before', () => {
        expect(growWidths([], [64, 80])).toEqual([64, 80]);
    });
});
