import type { ValueKind } from './values.ts';

/* A schema in MySQL terms, which is a database there; SQLite has `main` and one per attached file. */
export interface SchemaInfo {
    readonly name: string;
    /* A schema the server keeps for itself, such as `information_schema`; a list hides these by default. */
    readonly system: boolean;
}

export type TableKind = 'table' | 'view';

export interface TableInfo {
    readonly name: string;
    readonly kind: TableKind;
    /* What the server's statistics say, which can be far off; `null` when it keeps none. */
    readonly rowEstimate: number | null;
    readonly comment: string | null;
}

export interface ColumnInfo {
    readonly name: string;
    /* The type as it was declared, such as `varchar(255)`; an SQLite column may have none, which is an empty string. */
    readonly type: string;
    readonly kind: ValueKind;
    readonly nullable: boolean;
    /* The default as an SQL expression, such as `'draft'` or `CURRENT_TIMESTAMP`. */
    readonly defaultValue: string | null;
    readonly autoIncrement: boolean;
    /* A column the server computes, which an insert or an update leaves alone. */
    readonly generated: boolean;
    readonly comment: string | null;
}

export interface IndexInfo {
    readonly name: string;
    readonly columns: readonly string[];
    readonly unique: boolean;
    readonly primary: boolean;
}

export interface ForeignKeyInfo {
    /* SQLite leaves a foreign key without a name unless the DDL gives it one. */
    readonly name: string | null;
    readonly columns: readonly string[];
    readonly referencedSchema: string;
    readonly referencedTable: string;
    readonly referencedColumns: readonly string[];
    /* The action as SQL, such as `CASCADE`; `null` is the engine's default. */
    readonly onUpdate: string | null;
    readonly onDelete: string | null;
}

export interface TableStructure {
    readonly schema: string;
    readonly name: string;
    readonly kind: TableKind;
    readonly columns: readonly ColumnInfo[];
    readonly primaryKey: readonly string[];
    /*
     * The columns that pick out one row for an update or a delete: the primary key, or else the first
     * unique index over columns that cannot be null. `null` when there is neither, and the table is read only.
     */
    readonly rowKey: readonly string[] | null;
    readonly indexes: readonly IndexInfo[];
    readonly foreignKeys: readonly ForeignKeyInfo[];
    /* The `CREATE` statement as the server writes it. */
    readonly ddl: string | null;
}

/* A column of a result, which may come from a table or from an expression. */
export interface ResultColumn {
    readonly name: string;
    /* The engine's name for the type of the value, such as `VARCHAR`; empty when it reports none. */
    readonly type: string;
    readonly kind: ValueKind;
}
