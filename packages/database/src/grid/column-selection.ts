/* The columns picked by a click on their headers, by index in the columns the grid was given. */
export interface ColumnSelection {
    readonly columns: ReadonlySet<number>;
    /* The column a Shift-click extends from; `null` when nothing is picked. */
    readonly anchor: number | null;
}

export interface ColumnClick {
    readonly shiftKey: boolean;
    readonly mod: boolean;
}

export const NO_COLUMN_SELECTION: ColumnSelection = { columns: new Set(), anchor: null };

/*
 * The selection after a click on the header of `index`. A plain click picks that column alone, Mod
 * toggles it, and Shift picks every column drawn between the anchor and it (added to the others with Mod).
 * `order` is the columns as drawn, so a range follows what the person sees.
 */
export const selectColumn = (current: ColumnSelection, order: readonly number[], index: number, click: ColumnClick): ColumnSelection => {
    const at = order.indexOf(index);
    if (at < 0) {
        return current;
    }
    const anchorAt = current.anchor === null ? -1 : order.indexOf(current.anchor);
    if (click.shiftKey && anchorAt >= 0) {
        const range = order.slice(Math.min(anchorAt, at), Math.max(anchorAt, at) + 1);
        return { columns: new Set(click.mod ? [...current.columns, ...range] : range), anchor: current.anchor };
    }
    if (click.mod) {
        const next = new Set(current.columns);
        if (next.delete(index)) {
            return { columns: next, anchor: next.size === 0 ? null : current.anchor };
        }
        next.add(index);
        return { columns: next, anchor: index };
    }
    return { columns: new Set([index]), anchor: index };
};

/* The picked columns that are drawn, in the order they are drawn. */
export const shownSelection = (current: ColumnSelection, order: readonly number[]): number[] => order.filter((index) => current.columns.has(index));
