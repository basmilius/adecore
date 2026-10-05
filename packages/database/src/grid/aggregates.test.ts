import { describe, expect, test } from 'bun:test';
import { aggregateBlock, blockSize } from './aggregates.ts';
import type { Shown } from './display.ts';

const rows: Shown[][] = [
    ['a', 10, '2.50'],
    ['b', 20, null],
    ['c', null, '0.25'],
    ['d', 5, { kind: 'default' }]
];
const kinds = ['text', 'integer', 'decimal'] as const;

describe('blockSize', () => {
    test('counts the cells of a block', () => {
        expect(blockSize({ top: 1, bottom: 3, columns: [0, 2] })).toBe(6);
        expect(blockSize({ top: 2, bottom: 2, columns: [1] })).toBe(1);
    });
});

describe('aggregateBlock', () => {
    test('counts every cell and sums the numbers of numeric columns', () => {
        const result = aggregateBlock(rows, kinds, { top: 0, bottom: 3, columns: [1] });
        expect(result.count).toBe(4);
        expect(result.numeric).toEqual({ count: 3, sum: 35, average: 35 / 3, minimum: 5, maximum: 20, minimumText: '5', maximumText: '20' });
    });

    test('reads a decimal that arrived as text and keeps its text for the extremes', () => {
        const result = aggregateBlock(rows, kinds, { top: 0, bottom: 3, columns: [2] });
        expect(result.numeric?.sum).toBeCloseTo(2.75);
        expect(result.numeric?.count).toBe(2);
        expect(result.numeric?.minimumText).toBe('0.25');
        expect(result.numeric?.maximumText).toBe('2.50');
    });

    test('leaves the text columns of a mixed block out of the numbers', () => {
        const result = aggregateBlock(rows, kinds, { top: 0, bottom: 1, columns: [0, 1] });
        expect(result.count).toBe(4);
        expect(result.numeric?.count).toBe(2);
        expect(result.numeric?.sum).toBe(30);
    });

    test('has no numbers for a block of text or of NULLs', () => {
        expect(aggregateBlock(rows, kinds, { top: 0, bottom: 3, columns: [0] })).toEqual({ count: 4, numeric: null });
        expect(aggregateBlock(rows, kinds, { top: 2, bottom: 2, columns: [1] })).toEqual({ count: 1, numeric: null });
    });

    test('ignores text that is not a number, even in a numeric column', () => {
        expect(aggregateBlock([['n/a'], ['12abc']], ['integer'], { top: 0, bottom: 1, columns: [0] }).numeric).toBeNull();
    });

    test('stops at the last row it has', () => {
        expect(aggregateBlock(rows, kinds, { top: 3, bottom: 9, columns: [1] }).count).toBe(1);
    });
});
