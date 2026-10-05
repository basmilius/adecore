import type { ColumnInfo } from '../protocol/index.ts';

export type ImportFormat = 'csv' | 'tsv';

/* The columns an import can fill: a generated column is computed by the server. */
export const importableColumns = (columns: readonly ColumnInfo[]): ColumnInfo[] => columns.filter((column) => !column.generated);

/* CSV or TSV by the extension of the path; CSV when it says neither. */
export const formatOfPath = (path: string): ImportFormat => (/\.(tsv|tab)$/i.test(path) ? 'tsv' : 'csv');

/*
 * The table column each file column goes to, as a name, or `null` for none. Names match without regard
 * to case and a table column takes at most one file column. A file without a header has no names to
 * match, so its columns go to the table's columns in order.
 */
export const matchColumns = (fileColumns: readonly string[], tableColumns: readonly string[], header: boolean): (string | null)[] => {
    if (!header) {
        return fileColumns.map((_, index) => tableColumns[index] ?? null);
    }
    const taken = new Set<string>();
    return fileColumns.map((name) => {
        const wanted = name.trim().toLowerCase();
        const match = tableColumns.find((column) => !taken.has(column) && column.toLowerCase() === wanted);
        if (match === undefined) {
            return null;
        }
        taken.add(match);
        return match;
    });
};

/* Whether anything is mapped, since an import of nothing is no import. */
export const hasMapping = (mapping: readonly (string | null)[]): boolean => mapping.some((column) => column !== null);

/* Maps a file column to a table column, taking the table column from any other file column that had it. */
export const mapColumn = (mapping: readonly (string | null)[], fileColumn: number, tableColumn: string | null): (string | null)[] =>
    mapping.map((current, index) => (index === fileColumn ? tableColumn : tableColumn !== null && current === tableColumn ? null : current));
