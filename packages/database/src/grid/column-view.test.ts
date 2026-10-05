import { describe, expect, test } from 'bun:test';
import { displayOrder, hideColumn, NO_COLUMN_VIEW, pinnedCount, showAllColumns, togglePin } from './column-view.ts';

describe('displayOrder', () => {
    test('is the natural order without a view', () => {
        expect(displayOrder(4, NO_COLUMN_VIEW)).toEqual([0, 1, 2, 3]);
    });

    test('puts pinned columns first in pin order', () => {
        const view = togglePin(togglePin(NO_COLUMN_VIEW, 3), 1);
        expect(displayOrder(4, view)).toEqual([3, 1, 0, 2]);
    });

    test('leaves hidden columns out', () => {
        expect(displayOrder(4, hideColumn(NO_COLUMN_VIEW, 2))).toEqual([0, 1, 3]);
    });

    test('ignores a pinned column that no longer exists', () => {
        expect(displayOrder(2, { hidden: new Set(), pinned: [5, 1] })).toEqual([1, 0]);
    });
});

describe('column view changes', () => {
    test('togglePin pins and unpins', () => {
        const pinned = togglePin(NO_COLUMN_VIEW, 2);
        expect(pinned.pinned).toEqual([2]);
        expect(togglePin(pinned, 2).pinned).toEqual([]);
    });

    test('hiding a pinned column unpins it', () => {
        const view = hideColumn(togglePin(NO_COLUMN_VIEW, 1), 1);
        expect(view.pinned).toEqual([]);
        expect([...view.hidden]).toEqual([1]);
    });

    test('showAllColumns brings every column back and keeps the pins', () => {
        const view = showAllColumns(hideColumn(togglePin(NO_COLUMN_VIEW, 0), 2));
        expect(view.hidden.size).toBe(0);
        expect(view.pinned).toEqual([0]);
    });
});

describe('pinnedCount', () => {
    test('counts the pinned columns that are drawn', () => {
        expect(pinnedCount(4, { hidden: new Set([3]), pinned: [3, 1, 9] })).toBe(1);
        expect(pinnedCount(4, NO_COLUMN_VIEW)).toBe(0);
    });
});
