import type { ColumnSort, SortDirection } from '../sql.ts';

export type GridSort = ColumnSort;

export const sortOnly = (column: string, direction: SortDirection): GridSort[] => [{ column, direction }];

export const sortStateOf = (sorts: readonly GridSort[], column: string): { direction: SortDirection; position: number } | null => {
    const index = sorts.findIndex((sort) => sort.column === column);

    return index < 0 ? null : { direction: sorts[index]!.direction, position: index + 1 };
};
