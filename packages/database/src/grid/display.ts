import { formatBytes } from '@adecore/ui/format';
import type { BinaryValue, Cell, EditValue, ValueKind } from '../protocol/index.ts';

/* What a cell shows: a cell of a result, or the column's default for a value an edit set to `DEFAULT`. */
export type Shown = Cell | { readonly kind: 'default' };

export type CellTone = 'value' | 'null' | 'default';

export interface CellView {
    readonly text: string;
    readonly tone: CellTone;
    readonly align: 'start' | 'end';
    /* Faint text after the value, such as the size of a binary value. */
    readonly suffix?: string;
}

/* A cell never draws more than this, however long the text: the DOM stays small and the cell is one line anyway. */
export const DISPLAY_LIMIT = 200;
/* How many bytes of a binary value the cell spells out. */
export const BINARY_PREVIEW_BYTES = 8;

const NUMERIC_KINDS: ReadonlySet<ValueKind> = new Set(['integer', 'decimal', 'float']);

/* Whether the cells of a column of this kind sit against the end of their cell, as numbers do. */
export const isNumericKind = (kind: ValueKind): boolean => NUMERIC_KINDS.has(kind);

const ELLIPSIS = '…';

const isObject = (cell: Shown): cell is Exclude<Shown, null | boolean | number | string> => cell !== null && typeof cell === 'object';

/* Whether a cell is only the start of its value, so editing it needs the whole value first. */
export const isPreview = (cell: Shown): boolean => {
    if (!isObject(cell)) {
        return false;
    }
    if (cell.kind === 'longText') {
        return true;
    }
    return cell.kind === 'binary' && cell.hex.length < cell.length * 2;
};

const cut = (text: string): string => (text.length > DISPLAY_LIMIT ? `${text.slice(0, DISPLAY_LIMIT)}${ELLIPSIS}` : text);

export const cellView = (cell: Shown, kind: ValueKind): CellView => {
    const align = isNumericKind(kind) ? 'end' : 'start';
    if (cell === null) {
        return { text: 'NULL', tone: 'null', align };
    }
    if (typeof cell === 'boolean') {
        return { text: cell ? 'true' : 'false', tone: 'value', align };
    }
    if (typeof cell === 'number') {
        return { text: String(cell), tone: 'value', align };
    }
    if (typeof cell === 'string') {
        return { text: cut(cell), tone: 'value', align };
    }
    switch (cell.kind) {
        case 'default':
            return { text: 'DEFAULT', tone: 'default', align };
        case 'longText':
            return { text: `${cut(cell.preview)}${cell.preview.length <= DISPLAY_LIMIT ? ELLIPSIS : ''}`, tone: 'value', align: 'start' };
        case 'binary': {
            const shown = cell.hex.slice(0, BINARY_PREVIEW_BYTES * 2);
            const truncated = shown.length < cell.length * 2;
            return { text: `0x${shown}${truncated ? ELLIPSIS : ''}`, tone: 'value', align: 'start', suffix: formatBytes(cell.length) };
        }
    }
};

/* The text a copy puts on the clipboard: the value as the cell has it, a preview as far as it goes. */
export const copyTextOf = (cell: Shown): string => {
    if (cell === null) {
        return 'NULL';
    }
    if (typeof cell !== 'object') {
        return String(cell);
    }
    switch (cell.kind) {
        case 'default':
            return 'DEFAULT';
        case 'longText':
            return cell.preview;
        case 'binary':
            return `0x${cell.hex}`;
    }
};

/* An edit as a cell, so the grid draws a pending value the way it draws a loaded one. */
export const shownOfEdit = (value: EditValue): Shown => {
    if (value !== null && typeof value === 'object' && value.kind === 'binary') {
        const binary = value as BinaryValue;
        return { kind: 'binary', hex: binary.hex, length: binary.hex.length / 2 };
    }
    return value as Shown;
};
