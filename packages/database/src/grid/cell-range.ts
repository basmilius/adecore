import type { CellPosition } from './navigation.ts';

/* A block of cells, both ends included. Columns are positions as drawn, so a block stays rectangular on screen. */
interface CellRect {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}

export const rectBetween = (from: CellPosition, to: CellPosition): CellRect => ({
    top: Math.min(from.row, to.row),
    bottom: Math.max(from.row, to.row),
    left: Math.min(from.column, to.column),
    right: Math.max(from.column, to.column)
});

export const rectContains = (rect: CellRect | null, row: number, column: number): boolean =>
    rect !== null && row >= rect.top && row <= rect.bottom && column >= rect.left && column <= rect.right;

export const fullRect = (rows: number, columns: number): CellRect | null =>
    rows === 0 || columns === 0 ? null : { top: 0, bottom: rows - 1, left: 0, right: columns - 1 };

export const rectSize = (rect: CellRect): { rows: number; columns: number } => ({ rows: rect.bottom - rect.top + 1, columns: rect.right - rect.left + 1 });
