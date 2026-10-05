import type { ConnectionConfig, ServerInfo } from './connection.ts';
import type { DatabaseError } from './errors.ts';
import type { ResultColumn, SchemaInfo, TableInfo, TableStructure } from './schema.ts';
import type { Cell, EditValue, Value } from './values.ts';

/* Raised whenever a message changes shape, so a host refuses a helper from another release. */
export const PROTOCOL_VERSION = 1;

/* The columns of the row key and their values. */
export type RowKey = Readonly<Record<string, Value>>;

export type RowChange =
    | { readonly kind: 'insert'; readonly values: Readonly<Record<string, EditValue>> }
    | { readonly kind: 'update'; readonly key: RowKey; readonly values: Readonly<Record<string, EditValue>> }
    | { readonly kind: 'delete'; readonly key: RowKey };

export interface RowsResult {
    readonly columns: readonly ResultColumn[];
    readonly rows: readonly (readonly Cell[])[];
    /* Whether a row exists past this page, which the helper learns by reading one row more than the limit. */
    readonly hasMore: boolean;
    readonly elapsedMs: number;
}

/* What one statement of an `execute` did. A failed statement ends the list, and the ones after it never ran. */
export type StatementResult =
    | ({ readonly kind: 'rows'; readonly sql: string } & RowsResult)
    | { readonly kind: 'done'; readonly sql: string; readonly affected: number; readonly lastInsertId: number | string | null; readonly elapsedMs: number }
    | { readonly kind: 'error'; readonly sql: string; readonly error: DatabaseError; readonly elapsedMs: number };

interface TableTarget {
    readonly session: string;
    readonly schema: string;
    readonly table: string;
}

/*
 * Every method with its params and its result. `where` and `orderBy` are SQL as a person types it
 * after those keywords; they reach the server as written, inside one statement. A connection opened
 * read only stays read only, so neither can write.
 */
export interface DatabaseMethods {
    open: { params: { readonly connection: ConnectionConfig }; result: { readonly session: string; readonly server: ServerInfo } };
    close: { params: { readonly session: string }; result: null };
    /* Opens a connection and closes it again, for a form that checks what a person filled in. */
    test: { params: { readonly connection: ConnectionConfig }; result: { readonly server: ServerInfo } };
    schemas: { params: { readonly session: string }; result: { readonly schemas: readonly SchemaInfo[] } };
    tables: { params: { readonly session: string; readonly schema: string }; result: { readonly tables: readonly TableInfo[] } };
    structure: { params: TableTarget; result: TableStructure };
    rows: {
        params: TableTarget & {
            readonly where?: string;
            readonly orderBy?: string;
            readonly offset: number;
            /* At most 10000. */
            readonly limit: number;
            /* Characters of text, or bytes of a binary value, before a cell becomes a preview. 1024 when left out. */
            readonly cellLimit?: number;
        };
        result: RowsResult;
    };
    count: { params: TableTarget & { readonly where?: string }; result: { readonly count: number } };
    /* The whole value of one cell, for a cell a read cut off. */
    cell: { params: TableTarget & { readonly key: RowKey; readonly column: string }; result: { readonly value: Value } };
    /* Every change in one transaction: all of them apply, or none does. */
    apply: { params: TableTarget & { readonly changes: readonly RowChange[] }; result: { readonly affected: number } };
    execute: {
        params: {
            readonly session: string;
            /* One statement or several, separated by semicolons. */
            readonly sql: string;
            /* The schema to switch to first, which stays selected for the session. */
            readonly schema?: string;
            /* Rows per result, at most 10000. 500 when left out. */
            readonly limit?: number;
            /* As for `rows`; 65536 when left out. */
            readonly cellLimit?: number;
        };
        result: { readonly results: readonly StatementResult[] };
    };
    /* Stops the request with this id. Answers whether it was still running; the request itself fails with `cancelled`. */
    cancel: { params: { readonly request: string }; result: { readonly cancelled: boolean } };
}

export type DatabaseMethod = keyof DatabaseMethods;

export type DatabaseParams<M extends DatabaseMethod> = DatabaseMethods[M]['params'];

export type DatabaseResult<M extends DatabaseMethod> = DatabaseMethods[M]['result'];

/* A request names its own `id`, which its response repeats and a `cancel` points at. */
export type DatabaseRequest<M extends DatabaseMethod = DatabaseMethod> = {
    [K in M]: { readonly id: string; readonly method: K; readonly params: DatabaseParams<K> };
}[M];

export type DatabaseResponse<M extends DatabaseMethod = DatabaseMethod> =
    | { readonly id: string; readonly ok: true; readonly result: DatabaseResult<M> }
    | { readonly id: string; readonly ok: false; readonly error: DatabaseError };

/* The first line a helper writes, before it reads a request. */
export interface HelperReady {
    readonly event: 'ready';
    readonly protocol: number;
    readonly version: string;
}
