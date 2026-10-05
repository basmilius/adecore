import type { ForeignKeyInfo, TableStructure } from '../protocol/index.ts';
import { generatedClausesOf, NO_OPTIONS, optionsOf, type TableOptions } from './parse.ts';

/*
 * Every item keeps the name it had in the structure it came from, so a rename is told apart from a
 * drop plus an add. `originalName` is `null` for an item the person added. `key` is stable while
 * the item is edited, which a name is not.
 */
export interface ColumnDraft {
    readonly key: string;
    readonly originalName: string | null;
    readonly name: string;
    /* The type as typed, such as `varchar(255)`; empty for an SQLite column without one. */
    readonly type: string;
    readonly nullable: boolean;
    /* An SQL expression such as `'draft'` or `CURRENT_TIMESTAMP`; `null` is no default. */
    readonly defaultValue: string | null;
    readonly autoIncrement: boolean;
    /* Empty for no comment. */
    readonly comment: string;
    /* A column the server computes. It is read only here: its clause travels along unchanged. */
    readonly generated: boolean;
    /* `GENERATED ALWAYS AS (...) STORED` as the table's DDL says it; `null` when the DDL did not show it. */
    readonly generatedClause: string | null;
}

export interface IndexDraft {
    readonly key: string;
    readonly originalName: string | null;
    readonly name: string;
    readonly columns: readonly string[];
    readonly unique: boolean;
}

export interface ForeignKeyDraft {
    readonly key: string;
    /* An SQLite foreign key without a name has the empty string; `null` is a key the person added. */
    readonly originalName: string | null;
    readonly name: string;
    readonly columns: readonly string[];
    readonly referencedSchema: string;
    readonly referencedTable: string;
    readonly referencedColumns: readonly string[];
    /* `null` is the engine's default. */
    readonly onUpdate: string | null;
    readonly onDelete: string | null;
}

export interface TableDraft {
    /* `null` for a table that does not exist yet. */
    readonly originalName: string | null;
    readonly name: string;
    readonly columns: readonly ColumnDraft[];
    /* Names of columns of the draft, in key order. */
    readonly primaryKey: readonly string[];
    /* Without the primary key, which has its own field. */
    readonly indexes: readonly IndexDraft[];
    readonly foreignKeys: readonly ForeignKeyDraft[];
    readonly options: TableOptions;
}

let counter = 0;

/* A key no other item of this page has. */
export const nextKey = (): string => `new-${++counter}`;

export const emptyColumn = (name = ''): ColumnDraft => ({
    key: nextKey(),
    originalName: null,
    name,
    type: '',
    nullable: true,
    defaultValue: null,
    autoIncrement: false,
    comment: '',
    generated: false,
    generatedClause: null
});

export const emptyDraft = (): TableDraft => ({
    originalName: null,
    name: '',
    columns: [],
    primaryKey: [],
    indexes: [],
    foreignKeys: [],
    options: NO_OPTIONS
});

/* SQLite names the index behind a `UNIQUE` or `PRIMARY KEY` constraint itself; such an index cannot be created or dropped by name. */
export const isAutoIndex = (name: string): boolean => name.startsWith('sqlite_autoindex_');

const foreignKeyDraftOf = (foreignKey: ForeignKeyInfo, at: number): ForeignKeyDraft => ({
    key: `foreign-key:${at}`,
    originalName: foreignKey.name ?? '',
    name: foreignKey.name ?? '',
    columns: foreignKey.columns,
    referencedSchema: foreignKey.referencedSchema,
    referencedTable: foreignKey.referencedTable,
    referencedColumns: foreignKey.referencedColumns,
    onUpdate: foreignKey.onUpdate,
    onDelete: foreignKey.onDelete
});

/* The draft that changes nothing: what a structure already says. */
export const draftOf = (structure: TableStructure): TableDraft => {
    const clauses = generatedClausesOf(structure.ddl);
    return {
        originalName: structure.name,
        name: structure.name,
        columns: structure.columns.map((column) => ({
            key: `column:${column.name}`,
            originalName: column.name,
            name: column.name,
            type: column.type,
            nullable: column.nullable,
            defaultValue: column.defaultValue,
            autoIncrement: column.autoIncrement,
            comment: column.comment ?? '',
            generated: column.generated,
            generatedClause: column.generated ? (clauses.get(column.name) ?? null) : null
        })),
        primaryKey: structure.primaryKey,
        indexes: structure.indexes
            .filter((index) => !index.primary)
            .map((index) => ({
                key: `index:${index.name}`,
                originalName: index.name,
                name: index.name,
                columns: index.columns,
                unique: index.unique
            })),
        foreignKeys: structure.foreignKeys.map(foreignKeyDraftOf),
        options: optionsOf(structure)
    };
};
