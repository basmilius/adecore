import { valueOfCell, type Cell, type Value } from '../protocol/index.ts';
import type { Shown } from './display.ts';

/* The whole value of a cell, or `undefined` when it is only a preview (or a pending DEFAULT, which holds no value). */
export const wholeValueOf = (cell: Shown): Value | undefined =>
    cell !== null && typeof cell === 'object' && cell.kind === 'default' ? undefined : valueOfCell(cell as Cell);

/* What a cell holds as far as it goes: the whole value, or the preview of a long text or a binary value. */
export const previewValueOf = (cell: Shown): Value => {
    const whole = wholeValueOf(cell);
    if (whole !== undefined) {
        return whole;
    }
    if (cell !== null && typeof cell === 'object') {
        if (cell.kind === 'longText') {
            return cell.preview;
        }
        if (cell.kind === 'binary') {
            return { kind: 'binary', hex: cell.hex };
        }
    }
    return null;
};
