import { sqlLiteral } from '../sql.ts';
import { columnSql } from './column.ts';
import { columnList, quote, sqliteSchemaPrefix, tableName, type Dialect } from './dialect.ts';
import { isAutoIndex, type ForeignKeyDraft, type IndexDraft, type TableDraft } from './draft.ts';
import type { TableOptions } from './parse.ts';

const INDENT = '    ';

/* `CONSTRAINT name FOREIGN KEY (...) REFERENCES t (...) ON UPDATE .. ON DELETE ..`, shared by a create and an `ADD`. */
export const foreignKeySql = (dialect: Dialect, schema: string, foreignKey: ForeignKeyDraft): string => {
    const sqlite = dialect.engine === 'sqlite';
    // SQLite cannot name another schema in a reference, and MySQL needs one only for another database.
    const target =
        sqlite || foreignKey.referencedSchema === '' || foreignKey.referencedSchema === schema
            ? quote(dialect, foreignKey.referencedTable)
            : `${quote(dialect, foreignKey.referencedSchema)}.${quote(dialect, foreignKey.referencedTable)}`;
    const parts = [
        ...(foreignKey.name === '' ? [] : [`CONSTRAINT ${quote(dialect, foreignKey.name)}`]),
        `FOREIGN KEY (${columnList(dialect, foreignKey.columns)})`,
        `REFERENCES ${target} (${columnList(dialect, foreignKey.referencedColumns)})`
    ];
    if (foreignKey.onUpdate !== null) {
        parts.push(`ON UPDATE ${foreignKey.onUpdate}`);
    }
    if (foreignKey.onDelete !== null) {
        parts.push(`ON DELETE ${foreignKey.onDelete}`);
    }
    return parts.join(' ');
};

/* `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ...`: the options that say something, and with `against` only those that differ from it. */
export const mysqlOptionsSql = (options: TableOptions, against?: TableOptions): string[] => {
    const changed = (field: 'engine' | 'charset' | 'collation' | 'comment'): boolean => options[field] !== '' && options[field] !== against?.[field];
    return [
        ...(changed('engine') ? [`ENGINE=${options.engine}`] : []),
        ...(changed('charset') ? [`DEFAULT CHARSET=${options.charset}`] : []),
        ...(changed('collation') ? [`COLLATE=${options.collation}`] : []),
        ...(changed('comment') ? [`COMMENT=${sqlLiteral('mysql', options.comment)}`] : [])
    ];
};

const sqliteOptionsSql = (options: TableOptions): string[] => [...(options.strict ? ['STRICT'] : []), ...(options.withoutRowid ? ['WITHOUT ROWID'] : [])];

const inlineIndexSql = (dialect: Dialect, index: IndexDraft): string =>
    [index.unique ? 'UNIQUE INDEX' : 'INDEX', ...(index.name === '' ? [] : [quote(dialect, index.name)]), `(${columnList(dialect, index.columns)})`].join(' ');

/* `CREATE [UNIQUE] INDEX name ON table (columns)`. */
export const createIndexSql = (dialect: Dialect, schema: string, table: string, index: Pick<IndexDraft, 'name' | 'columns' | 'unique'>): string =>
    `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${dialect.engine === 'sqlite' ? sqliteSchemaPrefix(dialect, schema) : ''}${quote(dialect, index.name)} ON ${tableName(dialect, dialect.engine === 'sqlite' ? '' : schema, table)} (${columnList(dialect, index.columns)})`;

export interface CreateParts {
    readonly table: string;
    /* SQLite creates its indexes after the table, where MySQL declares them inside it. */
    readonly indexes: readonly IndexDraft[];
}

/* The `CREATE TABLE` of a draft under a name of the caller's choosing, which a rebuild uses for the table it fills before the swap. */
export const createTableParts = (dialect: Dialect, schema: string, draft: TableDraft, name: string): CreateParts => {
    const sqlite = dialect.engine === 'sqlite';
    // SQLite declares AUTOINCREMENT on the column itself, which then is the whole primary key.
    const autoColumn =
        sqlite && draft.primaryKey.length === 1 ? draft.columns.find((column) => column.name === draft.primaryKey[0] && column.autoIncrement)?.name : undefined;
    const lines = draft.columns.map((column) => columnSql(dialect, column, { inlinePrimaryKey: column.name === autoColumn }));
    if (draft.primaryKey.length > 0 && autoColumn === undefined) {
        lines.push(`PRIMARY KEY (${columnList(dialect, draft.primaryKey)})`);
    }
    const separate: IndexDraft[] = [];
    for (const index of draft.indexes) {
        if (!sqlite) {
            lines.push(inlineIndexSql(dialect, index));
        } else if (isAutoIndex(index.name) && index.unique) {
            lines.push(`UNIQUE (${columnList(dialect, index.columns)})`);
        } else if (!isAutoIndex(index.name)) {
            separate.push(index);
        }
    }
    for (const foreignKey of draft.foreignKeys) {
        lines.push(foreignKeySql(dialect, schema, foreignKey));
    }
    const options = sqlite ? sqliteOptionsSql(draft.options).join(', ') : mysqlOptionsSql(draft.options).join(' ');
    const head = `CREATE TABLE ${tableName(dialect, schema, name)} (\n${lines.map((line) => INDENT + line).join(',\n')}\n)`;
    return { table: options === '' ? head : `${head} ${options}`, indexes: separate };
};

export const createTableSql = (dialect: Dialect, schema: string, draft: TableDraft): string[] => {
    const { table, indexes } = createTableParts(dialect, schema, draft, draft.name);
    return [table, ...indexes.map((index) => createIndexSql(dialect, schema, draft.name, index))];
};
