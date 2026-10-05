import { describe, expect, test } from 'bun:test';
import { fullRect, rectBetween, rectContains, rectSize } from './cell-range.ts';

describe('cell ranges', () => {
    test('rectBetween takes the corners in any order', () => {
        expect(rectBetween({ row: 4, column: 1 }, { row: 2, column: 3 })).toEqual({ top: 2, bottom: 4, left: 1, right: 3 });
    });

    test('rectContains holds the edges and nothing past them', () => {
        const rect = rectBetween({ row: 1, column: 1 }, { row: 2, column: 2 });
        expect(rectContains(rect, 1, 1)).toBe(true);
        expect(rectContains(rect, 2, 2)).toBe(true);
        expect(rectContains(rect, 3, 2)).toBe(false);
        expect(rectContains(rect, 1, 0)).toBe(false);
        expect(rectContains(null, 0, 0)).toBe(false);
    });

    test('fullRect covers the grid, or nothing when it is empty', () => {
        expect(fullRect(3, 2)).toEqual({ top: 0, bottom: 2, left: 0, right: 1 });
        expect(fullRect(0, 2)).toBeNull();
        expect(fullRect(3, 0)).toBeNull();
    });

    test('rectSize counts rows and columns', () => {
        expect(rectSize({ top: 1, bottom: 3, left: 0, right: 1 })).toEqual({ rows: 3, columns: 2 });
    });
});
