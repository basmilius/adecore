import type { ColumnSort, SortDirection } from '../sql.ts';

export type GridSort = ColumnSort;

/* The column as the only sort, in a direction a menu picked. */
export const sortOnly = (column: string, direction: SortDirection): GridSort[] => [{ column, direction }];

/* The sort of a column and its place among the sorts counted from one, or `null` when it is not sorted. */
export const sortStateOf = (sorts: readonly GridSort[], column: string): { direction: SortDirection; position: number } | null => {
    const index = sorts.findIndex((sort) => sort.column === column);
    return index < 0 ? null : { direction: sorts[index]!.direction, position: index + 1 };
};
