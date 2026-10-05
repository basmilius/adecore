import type { ColumnInfo, ResultColumn } from '../protocol/index.ts';
import type { Shown } from './display.ts';

/* A column of a result, with what the grid draws from its table when it comes from one. */
export interface GridColumn extends ResultColumn {
    readonly primaryKey?: boolean;
    /* `false` makes Set NULL unavailable; unknown (an expression) leaves it open. */
    readonly nullable?: boolean;
    /* A column no cell of which can be edited, such as a generated one. */
    readonly readOnly?: boolean;
}

export type GridRowState = 'inserted' | 'deleted';

export interface GridRow {
    /* Stable while the row is on the grid, since the selection and the edits are kept by it. */
    readonly key: string;
    /* The number in the gutter; `null` for a row that does not exist yet. */
    readonly number: number | null;
    readonly cells: readonly Shown[];
    readonly state?: GridRowState;
    /* Indexes of the cells with a pending edit. */
    readonly edited?: ReadonlySet<number>;
    /* A row that cannot be edited even though the grid can, such as one whose key is only a preview. */
    readonly locked?: boolean;
}

/* Builds the column of a table from the result column and the structure's column of the same name. */
export const gridColumnOf = (column: ResultColumn, info: ColumnInfo | undefined, primaryKey: readonly string[]): GridColumn => ({
    ...column,
    primaryKey: primaryKey.includes(column.name),
    nullable: info?.nullable,
    readOnly: info?.generated === true
});
