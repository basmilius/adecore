import { shownOfEdit, type Shown } from '../grid/display.ts';
import { wholeValueOf } from '../grid/focused-value.ts';
import { gridColumnOf, type GridColumn, type GridRow } from '../grid/types.ts';
import type { EditValue, RowsResult, TableStructure } from '../protocol/index.ts';
import { rowKeyOf, type PendingChanges } from './pending.ts';

export type RowRef = { readonly kind: 'loaded'; readonly index: number } | { readonly kind: 'inserted'; readonly id: number };

export const loadedRowKey = (index: number): string => `row:${index}`;

export const insertedRowKey = (id: number): string => `new:${id}`;

export const parseRowKey = (key: string): RowRef =>
    key.startsWith('new:') ? { kind: 'inserted', id: Number(key.slice(4)) } : { kind: 'loaded', index: Number(key.slice(4)) };

export const buildGridColumns = (loaded: Pick<RowsResult, 'columns'>, structure: TableStructure | null): GridColumn[] => {
    const keys = { primaryKey: structure?.primaryKey ?? [], foreignKey: structure?.foreignKeys.flatMap((key) => key.columns) ?? [] };
    const infoOf = (name: string) => structure?.columns.find((info) => info.name === name);
    return loaded.columns.map((column) => gridColumnOf(column, infoOf(column.name), keys));
};

export interface GridRowsInput {
    readonly structure: TableStructure | null;
    readonly loaded: Pick<RowsResult, 'columns' | 'rows'>;
    readonly pending: PendingChanges;
    /* Rows before this page, so the gutter counts from the first row of the table. */
    readonly offset: number;
}

/* The loaded rows with their pending edits laid over them, then the rows waiting to be inserted. */
export const buildGridRows = ({ structure, loaded, pending, offset }: GridRowsInput): GridRow[] => {
    const rows = loaded.rows.map((cells, index): GridRow => {
        const edits = pending.edits[index];
        const edited = new Set<number>();
        const shown = cells.map((cell, column): Shown => {
            const edit = edits?.[loaded.columns[column]!.name];
            if (edit === undefined) {
                return cell;
            }
            edited.add(column);
            return shownOfEdit(edit);
        });
        return {
            key: loadedRowKey(index),
            number: offset + index + 1,
            cells: shown,
            state: pending.deletes.has(index) ? 'deleted' : undefined,
            edited,
            locked: structure === null || rowKeyOf(structure, loaded, index) === null
        };
    });
    const inserted = pending.inserts.map((row): GridRow => ({
        key: insertedRowKey(row.id),
        number: null,
        cells: loaded.columns.map((column): Shown => {
            const value = row.values[column.name];
            return value === undefined ? { kind: 'default' } : shownOfEdit(value);
        }),
        state: 'inserted'
    }));
    return [...rows, ...inserted];
};

/*
 * The values a copy of a row starts from: what the row shows, except the columns the server fills in
 * (an auto-increment key, a generated column) and the cells that are only a preview or a DEFAULT.
 */
export const cloneValues = (columns: readonly GridColumn[], cells: readonly Shown[]): Record<string, EditValue> => {
    const values: Record<string, EditValue> = {};
    columns.forEach((column, index) => {
        const value = column.autoIncrement === true || column.readOnly === true ? undefined : wholeValueOf(cells[index] ?? null);
        if (value !== undefined) {
            values[column.name] = value;
        }
    });
    return values;
};
