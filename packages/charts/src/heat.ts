/* The share of the color in the lowest step, so the smallest count still reads apart from an empty cell. */
export const FLOOR = 15;

export interface HeatCell {
    readonly row: number;
    readonly column: number;
}

/* The step of a value from 1 to `steps`, by its share of `max`; 0 is an empty cell, for nothing, zero or less. */
export function heatStep(value: number | null, max: number, steps: number): number {
    if (value === null || !Number.isFinite(value) || value <= 0 || max <= 0) {
        return 0;
    }

    return Math.min(steps, Math.max(1, Math.ceil((value / max) * steps)));
}

/* The percentage of the color in a step, up to 100 for the last; 0 for an empty cell. */
export function heatShare(step: number, steps: number): number {
    if (step <= 0) {
        return 0;
    }

    return steps <= 1 ? 100 : Math.round(FLOOR + ((step - 1) / (steps - 1)) * (100 - FLOOR));
}

/* The percentage of the color in a cell: in `steps` shades when given, else following the value; 0 for an empty cell. */
export function heatMix(value: number | null, max: number, steps?: number): number {
    if (steps !== undefined) {
        return heatShare(heatStep(value, max, steps), steps);
    }

    if (heatStep(value, max, 1) === 0) {
        return 0;
    }

    return Math.round(FLOOR + Math.min(1, value! / max) * (100 - FLOOR));
}

/*
 * Where a key moves the active cell: the arrows step a cell, Home and End go to the ends of the row, and with Control
 * to the first and the last cell. `null` clears it, `undefined` leaves the key to the page.
 */
export function moveCell(key: string, current: HeatCell | null, rows: number, columns: number, control = false): HeatCell | null | undefined {
    if (rows === 0 || columns === 0) {
        return undefined;
    }

    const at = current ?? { row: 0, column: 0 };

    switch (key) {
        case 'ArrowRight':
            return current === null ? at : { row: at.row, column: Math.min(columns - 1, at.column + 1) };
        case 'ArrowLeft':
            return current === null ? at : { row: at.row, column: Math.max(0, at.column - 1) };
        case 'ArrowDown':
            return current === null ? at : { row: Math.min(rows - 1, at.row + 1), column: at.column };
        case 'ArrowUp':
            return current === null ? at : { row: Math.max(0, at.row - 1), column: at.column };
        case 'Home':
            return { row: control ? 0 : at.row, column: 0 };
        case 'End':
            return { row: control ? rows - 1 : at.row, column: columns - 1 };
        case 'Escape':
            return current === null ? undefined : null;
        default:
            return undefined;
    }
}
