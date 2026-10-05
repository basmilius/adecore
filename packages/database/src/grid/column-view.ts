/* Which columns of a grid are hidden and which are pinned, by their index in the columns the grid was given. */
export interface ColumnView {
    readonly hidden: ReadonlySet<number>;
    /* In the order they were pinned, which is the order they sit in. */
    readonly pinned: readonly number[];
}

export const NO_COLUMN_VIEW: ColumnView = { hidden: new Set(), pinned: [] };

/* The columns to draw as indexes: the pinned ones first in pin order, then the rest as they come, hidden ones left out. */
export const displayOrder = (count: number, view: ColumnView): number[] => {
    const pinned = view.pinned.filter((index) => index < count && !view.hidden.has(index));
    const rest: number[] = [];
    for (let i = 0; i < count; i++) {
        if (!view.hidden.has(i) && !pinned.includes(i)) {
            rest.push(i);
        }
    }
    return [...pinned, ...rest];
};

export const hideColumn = (view: ColumnView, index: number): ColumnView => ({
    hidden: new Set([...view.hidden, index]),
    pinned: view.pinned.filter((pinned) => pinned !== index)
});

export const showAllColumns = (view: ColumnView): ColumnView => ({ ...view, hidden: new Set() });

export const togglePin = (view: ColumnView, index: number): ColumnView => ({
    ...view,
    pinned: view.pinned.includes(index) ? view.pinned.filter((pinned) => pinned !== index) : [...view.pinned, index]
});

/* How many of the first columns of `displayOrder` are pinned. */
export const pinnedCount = (count: number, view: ColumnView): number => view.pinned.filter((index) => index < count && !view.hidden.has(index)).length;
