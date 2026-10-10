import type { ValueKind } from '../protocol/index.ts';
import { isNumericKind, NUMERIC_TEXT } from '../sql.ts';
import type { Shown } from './display.ts';

/* A block of rows, and the columns (indexes into the columns of the grid) it spans. */
export interface RangeBlock {
    readonly top: number;
    readonly bottom: number;
    readonly columns: readonly number[];
}

export interface NumericAggregates {
    /* The cells that held a number; NULLs and the cells of other columns do not count. */
    readonly count: number;
    readonly sum: number;
    readonly average: number;
    readonly minimum: number;
    readonly maximum: number;
    /* The extremes as the cells spell them, which a decimal or a big integer keeps in full. */
    readonly minimumText: string;
    readonly maximumText: string;
}

export interface Aggregates {
    /* Every cell of the block. */
    readonly count: number;
    /* `null` when no cell of the block held a number. */
    readonly numeric: NumericAggregates | null;
}

const numberOf = (cell: Shown): { value: number; text: string } | null => {
    if (typeof cell === 'number') {
        return Number.isFinite(cell) ? { value: cell, text: String(cell) } : null;
    }
    if (typeof cell === 'string') {
        const text = cell.trim();
        return NUMERIC_TEXT.test(text) ? { value: Number(text), text } : null;
    }
    return null;
};

/* The size of a block in cells, which a footer shows aggregates for once it passes one. */
export const blockSize = (block: RangeBlock): number => Math.max(0, block.bottom - block.top + 1) * block.columns.length;

/*
 * The count of a block, and for the cells in numeric columns their sum, average, minimum and maximum.
 * Only the rows the grid has are counted, which is the loaded page.
 */
export const aggregateBlock = (rows: readonly (readonly Shown[])[], kinds: readonly ValueKind[], block: RangeBlock): Aggregates => {
    let count = 0;
    let numbers = 0;
    let sum = 0;
    let minimum: { value: number; text: string } | null = null;
    let maximum: { value: number; text: string } | null = null;
    for (let row = block.top; row <= block.bottom; row++) {
        const cells = rows[row];
        if (cells === undefined) {
            continue;
        }
        for (const column of block.columns) {
            count++;
            const kind = kinds[column];
            const found = kind !== undefined && isNumericKind(kind) ? numberOf(cells[column] ?? null) : null;
            if (found === null) {
                continue;
            }
            numbers++;
            sum += found.value;
            if (minimum === null || found.value < minimum.value) {
                minimum = found;
            }
            if (maximum === null || found.value > maximum.value) {
                maximum = found;
            }
        }
    }
    if (numbers === 0 || minimum === null || maximum === null) {
        return { count, numeric: null };
    }
    return {
        count,
        numeric: {
            count: numbers,
            sum,
            average: sum / numbers,
            minimum: minimum.value,
            maximum: maximum.value,
            minimumText: minimum.text,
            maximumText: maximum.text
        }
    };
};
