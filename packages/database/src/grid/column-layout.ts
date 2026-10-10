import type { ColumnView } from './column-view.ts';
import { MAX_RESIZED_WIDTH, MIN_COLUMN_WIDTH } from './layout.ts';

/* What a person did to the columns of a grid, by column name so it outlives a change of the column order. */
export interface GridLayout {
    /* Only the widths a person set by dragging or fitting. */
    readonly widths: Readonly<Record<string, number>>;
    readonly hidden: readonly string[];
    /* In the order they were pinned. */
    readonly pinned: readonly string[];
}

export const NO_GRID_LAYOUT: GridLayout = { widths: {}, hidden: [], pinned: [] };

export interface ColumnState {
    readonly resized: Readonly<Record<number, number>>;
    readonly view: ColumnView;
}

/* The state of a grid for columns it has, from a layout. Names it does not have are skipped; a layout that would hide every column hides none. */
export const restoreLayout = (columns: readonly { readonly name: string }[], layout: GridLayout | undefined): ColumnState => {
    const resized: Record<number, number> = {};
    const hidden = new Set<number>();
    const pinned: number[] = [];
    if (layout !== undefined) {
        columns.forEach((column, index) => {
            const width = layout.widths[column.name];
            if (width !== undefined) {
                resized[index] = Math.max(MIN_COLUMN_WIDTH, Math.min(Math.round(width), MAX_RESIZED_WIDTH));
            }
            if (layout.hidden.includes(column.name)) {
                hidden.add(index);
            }
        });
        for (const name of layout.pinned) {
            const index = columns.findIndex((column) => column.name === name);
            if (index >= 0 && !hidden.has(index) && !pinned.includes(index)) {
                pinned.push(index);
            }
        }
    }
    return { resized, view: { hidden: hidden.size >= columns.length ? new Set() : hidden, pinned } };
};

/* The layout of a grid's state, with the columns by name. */
export const captureLayout = (columns: readonly { readonly name: string }[], state: ColumnState): GridLayout => {
    const widths: Record<string, number> = {};
    for (const [index, width] of Object.entries(state.resized)) {
        const column = columns[Number(index)];
        if (column !== undefined) {
            widths[column.name] = width;
        }
    }
    const namesOf = (indexes: readonly number[]): string[] => indexes.flatMap((index) => columns[index]?.name ?? []);
    return {
        widths,
        hidden: namesOf([...state.view.hidden].sort((a, b) => a - b)),
        pinned: namesOf(state.view.pinned)
    };
};

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);

export const sameLayout = (a: GridLayout, b: GridLayout): boolean => {
    const names = Object.keys(a.widths);
    return (
        names.length === Object.keys(b.widths).length &&
        names.every((name) => a.widths[name] === b.widths[name]) &&
        sameList(a.hidden, b.hidden) &&
        sameList(a.pinned, b.pinned)
    );
};
