import { valueOfCell, type Cell, type EditValue, type RowChange, type RowKey, type RowsResult, type TableStructure, type Value } from '../protocol/index.ts';

export interface InsertedRow {
    /* Unique among the inserted rows; the grid keys the row by it. */
    readonly id: number;
    /* The columns a person filled in; the others take their default. */
    readonly values: Readonly<Record<string, EditValue>>;
}

/*
 * What a person changed on one page of a table and has not submitted yet. Rows are named by their
 * index in the page as loaded, so a pending set belongs to that page and is dropped with it.
 */
export interface PendingChanges {
    readonly edits: Readonly<Record<number, Readonly<Record<string, EditValue>>>>;
    readonly inserts: readonly InsertedRow[];
    readonly deletes: ReadonlySet<number>;
}

export const emptyPending: PendingChanges = { edits: {}, inserts: [], deletes: new Set() };

export const isPendingEmpty = (pending: PendingChanges): boolean =>
    Object.keys(pending.edits).length === 0 && pending.inserts.length === 0 && pending.deletes.size === 0;

/* How many row changes a submit sends: an edited row that is also deleted counts once, as the delete. */
export const pendingCount = (pending: PendingChanges): number =>
    Object.keys(pending.edits).filter((row) => !pending.deletes.has(Number(row))).length + pending.inserts.length + pending.deletes.size;

export const valuesEqual = (left: EditValue | undefined, right: EditValue | undefined): boolean => {
    if (left === undefined || right === undefined) {
        return false;
    }
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
        return left === right;
    }
    return left.kind === right.kind && (left.kind !== 'binary' || (right.kind === 'binary' && left.hex === right.hex));
};

/* Sets a cell of a loaded row; setting it back to what the row held removes the edit. */
export const setEdit = (pending: PendingChanges, row: number, column: string, value: EditValue, original: Cell): PendingChanges => {
    const { [row]: current = {}, ...others } = pending.edits;
    const { [column]: _replaced, ...kept } = current;
    const next = valuesEqual(value, valueOfCell(original)) ? kept : { ...kept, [column]: value };
    return { ...pending, edits: Object.keys(next).length === 0 ? others : { ...others, [row]: next } };
};

/* A new row to insert, filled in with `values`. */
export const addInsertWith = (pending: PendingChanges, values: Readonly<Record<string, EditValue>>): PendingChanges => ({
    ...pending,
    inserts: [...pending.inserts, { id: pending.inserts.reduce((highest, row) => Math.max(highest, row.id), 0) + 1, values }]
});

export const addInsert = (pending: PendingChanges): PendingChanges => addInsertWith(pending, {});

export const setInsertValue = (pending: PendingChanges, id: number, column: string, value: EditValue): PendingChanges => ({
    ...pending,
    inserts: pending.inserts.map((row) => (row.id === id ? { ...row, values: { ...row.values, [column]: value } } : row))
});

export const removeInsert = (pending: PendingChanges, id: number): PendingChanges => ({ ...pending, inserts: pending.inserts.filter((row) => row.id !== id) });

export const markDeleted = (pending: PendingChanges, rows: readonly number[]): PendingChanges => ({
    ...pending,
    deletes: new Set([...pending.deletes, ...rows])
});

/* Takes back every change to one loaded row: its edits and its deletion. */
export const revertRow = (pending: PendingChanges, row: number): PendingChanges => {
    const { [row]: _dropped, ...edits } = pending.edits;
    const deletes = new Set(pending.deletes);
    deletes.delete(row);
    return { ...pending, edits, deletes };
};

/* Rows of a page, by the index of the loaded ones and the id of the inserted ones. */
export interface RowSelectionRefs {
    readonly loaded: readonly number[];
    readonly inserted: readonly number[];
}

/* Takes back every change to the given rows: the edits and deletion marks of the loaded ones, and the inserted ones altogether. */
export const revertRows = (pending: PendingChanges, rows: RowSelectionRefs): PendingChanges => {
    const reverted = rows.loaded.reduce(revertRow, pending);
    return { ...reverted, inserts: reverted.inserts.filter((row) => !rows.inserted.includes(row.id)) };
};

/* Whether any of the given rows has something to take back. */
export const hasRowChanges = (pending: PendingChanges, rows: RowSelectionRefs): boolean =>
    rows.loaded.some((row) => pending.edits[row] !== undefined || pending.deletes.has(row)) || pending.inserts.some((row) => rows.inserted.includes(row.id));

type LoadedRows = Pick<RowsResult, 'columns' | 'rows'>;

/*
 * The key that picks out one loaded row, from its own values in the columns of the structure's row
 * key. `null` when the table has no row key, or a key cell is only a preview, in which case the row
 * cannot be told apart safely and stays read only.
 */
export const rowKeyOf = (structure: TableStructure, loaded: LoadedRows, row: number): RowKey | null => {
    const cells = loaded.rows[row];
    if (structure.rowKey === null || cells === undefined) {
        return null;
    }
    const key: Record<string, Value> = {};
    for (const name of structure.rowKey) {
        const index = loaded.columns.findIndex((column) => column.name === name);
        const value = index < 0 ? undefined : valueOfCell(cells[index] as Cell);
        if (value === undefined) {
            return null;
        }
        key[name] = value;
    }
    return key;
};

/* Updates, then deletes, then inserts, all computed against the page as loaded. Throws for a change on a row without a usable key, which the grid never lets a person make. */
export const toRowChanges = (structure: TableStructure, loaded: LoadedRows, pending: PendingChanges): RowChange[] => {
    const keyOf = (row: number): RowKey => {
        const key = rowKeyOf(structure, loaded, row);
        if (key === null) {
            throw new Error(`Row ${row + 1} of ${structure.name} has no usable key.`);
        }
        return key;
    };
    const updates = Object.keys(pending.edits)
        .map(Number)
        .filter((row) => !pending.deletes.has(row))
        .sort((left, right) => left - right)
        .map((row): RowChange => ({ kind: 'update', key: keyOf(row), values: pending.edits[row]! }));
    const deletes = [...pending.deletes].sort((left, right) => left - right).map((row): RowChange => ({ kind: 'delete', key: keyOf(row) }));
    const inserts = pending.inserts.map((row): RowChange => ({ kind: 'insert', values: row.values }));
    return [...updates, ...deletes, ...inserts];
};

const keyValueText = (value: Value): string => {
    if (value === null) {
        return 'NULL';
    }
    if (typeof value === 'object') {
        return `0x${value.hex}`;
    }
    return typeof value === 'string' ? `'${value}'` : String(value);
};

/* A key as a person would write it in a WHERE: `id = 5, tenant = 'a'`. */
export const describeKey = (key: RowKey): string =>
    Object.entries(key)
        .map(([column, value]) => `${column} = ${keyValueText(value)}`)
        .join(', ');
