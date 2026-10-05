import { wholeValueOf } from '../grid/focused-value.ts';
import type { Shown } from '../grid/display.ts';
import type { Engine, ForeignKeyInfo, ValueKind } from '../protocol/index.ts';
import { matchCondition, type ColumnMatch } from '../sql.ts';

/* Where a foreign key points for one row: the referenced table and the condition that picks the row out. */
export interface Reference {
    readonly schema: string;
    readonly table: string;
    readonly where: string;
}

/* The foreign key a column is part of; the first one when a column sits in several. */
export const foreignKeyOf = (foreignKeys: readonly ForeignKeyInfo[], column: string): ForeignKeyInfo | undefined =>
    foreignKeys.find((key) => key.columns.includes(column));

/*
 * The row a foreign key points to, from the cells of the referencing row. `null` when any column of
 * the key is NULL (it references nothing), is only a preview, or is not among the columns.
 */
export const referenceOf = (
    engine: Engine,
    key: ForeignKeyInfo,
    columns: readonly { readonly name: string; readonly kind: ValueKind }[],
    cells: readonly Shown[]
): Reference | null => {
    const matches: ColumnMatch[] = [];
    for (const [position, name] of key.columns.entries()) {
        const referenced = key.referencedColumns[position];
        const index = columns.findIndex((column) => column.name === name);
        const value = index < 0 ? undefined : wholeValueOf(cells[index] ?? null);
        if (referenced === undefined || value === undefined || value === null) {
            return null;
        }
        matches.push({ column: referenced, value, kind: columns[index]!.kind });
    }
    return matches.length === 0 ? null : { schema: key.referencedSchema, table: key.referencedTable, where: matchCondition(engine, matches) };
};
