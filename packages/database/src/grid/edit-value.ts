import type { Cell, EditValue, Value, ValueKind } from '../protocol/index.ts';

/* An empty field means NULL where an empty string cannot be a value of the column. */
const EMPTY_IS_NULL: ReadonlySet<ValueKind> = new Set(['integer', 'decimal', 'float', 'boolean', 'date', 'time', 'datetime', 'binary']);

const INTEGER = /^[+-]?\d+$/;
const HEX = /^0x([0-9a-f]*)$/i;

/* The text an editor starts with for a value that is whole (a preview has to be loaded first). */
export const draftOf = (value: Cell | Value | { readonly kind: 'default' }): string => {
    if (value === null) {
        return '';
    }
    if (typeof value !== 'object') {
        return String(value);
    }
    if (value.kind === 'binary') {
        return `0x${value.hex}`;
    }
    if (value.kind === 'longText') {
        return value.preview;
    }
    return '';
};

/* What a person typed, as the value to send. A number the text spells exactly stays a number; anything else goes as text and the server decides. */
export const parseDraft = (text: string, kind: ValueKind): EditValue => {
    const trimmed = text.trim();
    if (trimmed === '' && EMPTY_IS_NULL.has(kind)) {
        return null;
    }
    switch (kind) {
        case 'integer': {
            const number = Number(trimmed);
            return INTEGER.test(trimmed) && Number.isSafeInteger(number) ? number : trimmed;
        }
        case 'float': {
            const number = Number(trimmed);
            return Number.isFinite(number) ? number : trimmed;
        }
        case 'boolean': {
            const lower = trimmed.toLowerCase();
            if (lower === 'true' || lower === '1') {
                return true;
            }
            return lower === 'false' || lower === '0' ? false : trimmed;
        }
        case 'binary': {
            const match = HEX.exec(trimmed);
            return match !== null && match[1]!.length % 2 === 0 ? { kind: 'binary', hex: match[1]!.toLowerCase() } : trimmed;
        }
        case 'decimal':
        case 'date':
        case 'time':
        case 'datetime':
            return trimmed;
        default:
            return text;
    }
};
