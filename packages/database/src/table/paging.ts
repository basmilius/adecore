export const PAGE_SIZES = [100, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 500;

export interface PageBounds {
    /* One-based number of the first and last row on the page; both 0 on an empty page. */
    readonly from: number;
    readonly to: number;
    /* The number of rows in the table when known, else the least it can be (`exact` is then false). */
    readonly total: number;
    readonly exact: boolean;
    readonly hasPrevious: boolean;
    readonly hasNext: boolean;
}

/*
 * Where a page sits. Without a count, a page that `hasMore` says only that one row exists past it, so
 * the total is that many and the footer writes it as `501+`.
 */
export const pageBounds = (offset: number, rowCount: number, hasMore: boolean, counted: number | null): PageBounds => {
    const exact = counted !== null || !hasMore;
    const total = counted ?? (hasMore ? offset + rowCount + 1 : offset + rowCount);
    return {
        from: rowCount === 0 ? 0 : offset + 1,
        to: offset + rowCount,
        total,
        exact,
        hasPrevious: offset > 0,
        hasNext: counted === null ? hasMore : offset + rowCount < counted
    };
};

/* Where the last page starts, given how many rows the table has. */
export const lastPageOffset = (total: number, pageSize: number): number => (total <= 0 ? 0 : Math.floor((total - 1) / pageSize) * pageSize);
