/*
 * Every value crosses as JSON, so an app can carry it over any channel it already has. An integer
 * beyond `Number.MAX_SAFE_INTEGER`, a decimal, a date and a time arrive as the text the server
 * writes for them, so nothing is rounded on the way.
 */

/* Bytes as lowercase hex. */
export interface BinaryValue {
    readonly kind: 'binary';
    readonly hex: string;
}

/* A whole value, as a key or an edit carries it. */
export type Value = null | boolean | number | string | BinaryValue;

/* What a cell in an edit is set to: a value, or the column's default. */
export type EditValue = Value | { readonly kind: 'default' };

/* Bytes in a result. `hex` holds the first bytes only when `length` is larger than `hex.length / 2`. */
export interface BinaryCell {
    readonly kind: 'binary';
    readonly hex: string;
    /* The size of the whole value, in bytes. */
    readonly length: number;
}

/* Text cut off at the cell limit of the read. A cell that fits arrives as a plain string. */
export interface LongTextCell {
    readonly kind: 'longText';
    readonly preview: string;
    /* The length of the whole value, in characters. */
    readonly length: number;
}

/* A value in a result: whole when it fits the cell limit of the read, a preview when it does not. */
export type Cell = null | boolean | number | string | BinaryCell | LongTextCell;

/* What a value is, independent of the engine's name for its type, so a grid can align and edit it. */
export type ValueKind = 'integer' | 'decimal' | 'float' | 'boolean' | 'text' | 'binary' | 'date' | 'time' | 'datetime' | 'json' | 'other';

/* The value a row key or an update can use for a cell, or `undefined` when the cell is only a preview. */
export const valueOfCell = (cell: Cell): Value | undefined => {
    if (cell === null || typeof cell !== 'object') {
        return cell;
    }

    if (cell.kind === 'binary') {
        return cell.hex.length === cell.length * 2 ? { kind: 'binary', hex: cell.hex } : undefined;
    }

    return undefined;
};
