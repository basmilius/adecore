export interface CellPosition {
    readonly row: number;
    readonly column: number;
}

export interface GridSize {
    readonly rows: number;
    readonly columns: number;
    /* How many rows a PageUp or PageDown moves. */
    readonly page: number;
}

export interface NavigationKey {
    readonly key: string;
    readonly shiftKey: boolean;
    /* The platform's own modifier. */
    readonly mod: boolean;
}

/* Keys that, with no cell focused yet, only put the focus on the first one. */
const ENTERING_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Tab']);

const clamp = (value: number, max: number): number => Math.max(0, Math.min(value, max - 1));

/*
 * Where a navigation key takes the focus, or `null` when the key moves nothing and the browser should
 * keep it: that is also how Tab leaves the grid at its first and last cell.
 */
export const moveFocus = (from: CellPosition | null, input: NavigationKey, size: GridSize): CellPosition | null => {
    if (size.rows === 0 || size.columns === 0) {
        return null;
    }
    if (from === null && ENTERING_KEYS.has(input.key)) {
        return { row: 0, column: 0 };
    }
    const lastRow = size.rows - 1;
    const lastColumn = size.columns - 1;
    const start = from ?? { row: 0, column: 0 };
    const row = clamp(start.row, size.rows);
    const column = clamp(start.column, size.columns);

    switch (input.key) {
        case 'ArrowUp':
            return { row: clamp(row - 1, size.rows), column };
        case 'ArrowDown':
            return { row: clamp(row + 1, size.rows), column };
        case 'ArrowLeft':
            return { row, column: clamp(column - 1, size.columns) };
        case 'ArrowRight':
            return { row, column: clamp(column + 1, size.columns) };
        case 'PageUp':
            return { row: clamp(row - size.page, size.rows), column };
        case 'PageDown':
            return { row: clamp(row + size.page, size.rows), column };
        case 'Home':
            return { row: input.mod ? 0 : row, column: 0 };
        case 'End':
            return { row: input.mod ? lastRow : row, column: lastColumn };
        case 'Tab': {
            if (input.shiftKey) {
                if (column > 0) {
                    return { row, column: column - 1 };
                }
                return row > 0 ? { row: row - 1, column: lastColumn } : null;
            }
            if (column < lastColumn) {
                return { row, column: column + 1 };
            }
            return row < lastRow ? { row: row + 1, column: 0 } : null;
        }
        default:
            return null;
    }
};
