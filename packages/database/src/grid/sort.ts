import type { ColumnSort, SortDirection } from '../sql.ts';

export type GridSort = ColumnSort;

/* Ascending, then descending, then off. */
const NEXT: Record<SortDirection, SortDirection | null> = { asc: 'desc', desc: null };

/*
 * The sorts after a click on a header. A plain click makes the column the only sort and cycles it;
 * with `additive` (Shift) the column joins the others, keeping its place in the list while it cycles.
 */
export const cycleSort = (sorts: readonly GridSort[], column: string, additive: boolean): GridSort[] => {
    const index = sorts.findIndex((sort) => sort.column === column);
    const current = index < 0 ? undefined : sorts[index]!;
    const next = current === undefined ? 'asc' : NEXT[current.direction];
    if (!additive) {
        return next === null ? [] : [{ column, direction: next }];
    }
    if (current === undefined) {
        return [...sorts, { column, direction: 'asc' }];
    }
    return next === null ? sorts.filter((sort) => sort !== current) : sorts.map((sort) => (sort === current ? { column, direction: next } : sort));
};

/* The column as the only sort, in a direction a menu picked. */
export const sortOnly = (column: string, direction: SortDirection): GridSort[] => [{ column, direction }];

/* The sort of a column and its place among the sorts counted from one, or `null` when it is not sorted. */
export const sortStateOf = (sorts: readonly GridSort[], column: string): { direction: SortDirection; position: number } | null => {
    const index = sorts.findIndex((sort) => sort.column === column);
    return index < 0 ? null : { direction: sorts[index]!.direction, position: index + 1 };
};
