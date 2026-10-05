import { emptyColumn, nextKey, type ColumnDraft, type ForeignKeyDraft, type IndexDraft, type TableDraft, type TableOptions } from '../ddl/index.ts';

/* The editing steps of a draft. Each returns a new draft and leaves the one it was given alone. */

const replaceAt = <T extends { readonly key: string }>(items: readonly T[], key: string, change: (item: T) => T): T[] =>
    items.map((item) => (item.key === key ? change(item) : item));

const toggled = (names: readonly string[], name: string): string[] =>
    names.includes(name) ? names.filter((candidate) => candidate !== name) : [...names, name];

export const renameTable = (draft: TableDraft, name: string): TableDraft => ({ ...draft, name });

export const addColumn = (draft: TableDraft, type: string): TableDraft => ({
    ...draft,
    columns: [...draft.columns, { ...emptyColumn(), type, name: `column_${draft.columns.length + 1}` }]
});

/* A rename carries along every key, index and foreign key that names the column. */
export const patchColumn = (draft: TableDraft, key: string, patch: Partial<ColumnDraft>): TableDraft => {
    const before = draft.columns.find((column) => column.key === key);
    if (before === undefined) {
        return draft;
    }
    const inKey = draft.primaryKey.includes(before.name);
    const applied: Partial<ColumnDraft> = inKey && patch.nullable === true ? { ...patch, nullable: false } : patch;
    const after = { ...before, ...applied };
    const follow = (names: readonly string[]): string[] => names.map((name) => (name === before.name ? after.name : name));
    return {
        ...draft,
        columns: replaceAt(draft.columns, key, () => after),
        primaryKey: follow(draft.primaryKey),
        indexes: draft.indexes.map((index) => ({ ...index, columns: follow(index.columns) })),
        foreignKeys: draft.foreignKeys.map((foreignKey) => ({ ...foreignKey, columns: follow(foreignKey.columns) }))
    };
};

/* What names the column goes with it: an index keeps its other columns, a foreign key on it is dropped. */
export const removeColumn = (draft: TableDraft, key: string): TableDraft => {
    const gone = draft.columns.find((column) => column.key === key);
    if (gone === undefined) {
        return draft;
    }
    return {
        ...draft,
        columns: draft.columns.filter((column) => column.key !== key),
        primaryKey: draft.primaryKey.filter((name) => name !== gone.name),
        indexes: draft.indexes
            .map((index) => ({ ...index, columns: index.columns.filter((name) => name !== gone.name) }))
            .filter((index) => index.columns.length > 0),
        foreignKeys: draft.foreignKeys.filter((foreignKey) => !foreignKey.columns.includes(gone.name))
    };
};

export const moveColumn = (draft: TableDraft, key: string, offset: -1 | 1): TableDraft => {
    const from = draft.columns.findIndex((column) => column.key === key);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= draft.columns.length) {
        return draft;
    }
    const columns = [...draft.columns];
    [columns[from], columns[to]] = [columns[to]!, columns[from]!];
    return { ...draft, columns };
};

/* A column in the primary key cannot be null, so putting it there says so. */
export const togglePrimaryKey = (draft: TableDraft, key: string): TableDraft => {
    const column = draft.columns.find((candidate) => candidate.key === key);
    if (column === undefined) {
        return draft;
    }
    const joining = !draft.primaryKey.includes(column.name);
    const toggledKey = { ...draft, primaryKey: toggled(draft.primaryKey, column.name) };
    return joining ? patchColumn(toggledKey, key, { nullable: false }) : toggledKey;
};

export const addIndex = (draft: TableDraft): TableDraft => ({
    ...draft,
    indexes: [
        ...draft.indexes,
        { key: nextKey(), originalName: null, name: `idx_${draft.name || 'table'}_${draft.indexes.length + 1}`, columns: [], unique: false }
    ]
});

export const patchIndex = (draft: TableDraft, key: string, patch: Partial<IndexDraft>): TableDraft => ({
    ...draft,
    indexes: replaceAt(draft.indexes, key, (index) => ({ ...index, ...patch }))
});

export const toggleIndexColumn = (draft: TableDraft, key: string, column: string): TableDraft => ({
    ...draft,
    indexes: replaceAt(draft.indexes, key, (index) => ({ ...index, columns: toggled(index.columns, column) }))
});

export const removeIndex = (draft: TableDraft, key: string): TableDraft => ({ ...draft, indexes: draft.indexes.filter((index) => index.key !== key) });

export const addForeignKey = (draft: TableDraft, schema: string): TableDraft => ({
    ...draft,
    foreignKeys: [
        ...draft.foreignKeys,
        {
            key: nextKey(),
            originalName: null,
            name: `fk_${draft.name || 'table'}_${draft.foreignKeys.length + 1}`,
            columns: [],
            referencedSchema: schema,
            referencedTable: '',
            referencedColumns: [],
            onUpdate: null,
            onDelete: null
        }
    ]
});

export const patchForeignKey = (draft: TableDraft, key: string, patch: Partial<ForeignKeyDraft>): TableDraft => ({
    ...draft,
    foreignKeys: replaceAt(draft.foreignKeys, key, (foreignKey) => ({ ...foreignKey, ...patch }))
});

/* Another table has other columns, so the old pick is forgotten. */
export const setReferencedTable = (draft: TableDraft, key: string, schema: string, table: string): TableDraft =>
    patchForeignKey(draft, key, { referencedSchema: schema, referencedTable: table, referencedColumns: [] });

export const toggleForeignKeyColumn = (draft: TableDraft, key: string, side: 'columns' | 'referencedColumns', column: string): TableDraft => ({
    ...draft,
    foreignKeys: replaceAt(draft.foreignKeys, key, (foreignKey) => ({ ...foreignKey, [side]: toggled(foreignKey[side], column) }))
});

export const removeForeignKey = (draft: TableDraft, key: string): TableDraft => ({
    ...draft,
    foreignKeys: draft.foreignKeys.filter((foreignKey) => foreignKey.key !== key)
});

/* A collation belongs to a character set, so choosing another set empties it. */
export const patchOptions = (draft: TableDraft, patch: Partial<TableOptions>): TableDraft => {
    const charsetChanged = patch.charset !== undefined && patch.charset !== draft.options.charset;
    return { ...draft, options: { ...draft.options, ...(charsetChanged ? { collation: '' } : {}), ...patch } };
};
