export interface RowSelection {
    readonly selected: ReadonlySet<string>;
    /* The row a Shift-click extends from. */
    readonly anchor: number;
}

export interface RowClick {
    readonly shiftKey: boolean;
    readonly mod: boolean;
}

/*
 * The selection after a click on the gutter of `index`: a plain click selects that row alone, Mod
 * toggles it, and Shift selects everything from the anchor to it.
 */
export const selectRow = (keys: readonly string[], current: ReadonlySet<string>, anchor: number, index: number, click: RowClick): RowSelection => {
    const key = keys[index];
    if (key === undefined) {
        return { selected: current, anchor };
    }
    if (click.shiftKey && anchor >= 0 && anchor < keys.length) {
        const from = Math.min(anchor, index);
        const to = Math.max(anchor, index);
        const range = keys.slice(from, to + 1);
        return { selected: new Set(click.mod ? [...current, ...range] : range), anchor };
    }
    if (click.mod) {
        const next = new Set(current);
        if (!next.delete(key)) {
            next.add(key);
        }
        return { selected: next, anchor: index };
    }
    return { selected: new Set([key]), anchor: index };
};
