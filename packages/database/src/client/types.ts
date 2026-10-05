import type {
    ConnectionConfig,
    DatabaseErrorCode,
    DatabaseRequest,
    DatabaseResponse,
    RowChange,
    RowKey,
    RowsResult,
    SchemaInfo,
    ServerInfo,
    StatementResult,
    TableInfo,
    TableStructure,
    Value
} from '../protocol/index.ts';

/* How the page reaches the host: the app carries the request over its own channel and hands back what the host answered. */
export type DatabaseTransport = (request: DatabaseRequest) => Promise<DatabaseResponse>;

/* A connection a person saved, as the manager lists it and the app stores it. */
export interface Connection {
    /* Stable across edits, so the client keeps one session per connection. */
    readonly id: string;
    readonly name: string;
    readonly config: ConnectionConfig;
}

/* A table or a view in a connection. */
export interface TableRef {
    readonly connectionId: string;
    readonly schema: string;
    readonly table: string;
}

export interface RequestOptions {
    /* Aborting sends a `cancel` for the request, which then rejects with code `cancelled`. */
    readonly signal?: AbortSignal;
}

export interface RowsQuery {
    readonly where?: string;
    readonly orderBy?: string;
    readonly offset: number;
    readonly limit: number;
    readonly cellLimit?: number;
}

export interface ExecuteOptions extends RequestOptions {
    readonly schema?: string;
    readonly limit?: number;
    readonly cellLimit?: number;
}

/*
 * One open connection. It opens on its first request, and opens again when the host lost it (a helper
 * that exited); a read is then sent once more, a write or an `execute` fails with `unknown-session`,
 * since nobody can tell whether it ran.
 */
export interface DatabaseSession {
    readonly connection: Connection;
    server(options?: RequestOptions): Promise<ServerInfo>;
    schemas(options?: RequestOptions): Promise<readonly SchemaInfo[]>;
    tables(schema: string, options?: RequestOptions): Promise<readonly TableInfo[]>;
    structure(schema: string, table: string, options?: RequestOptions): Promise<TableStructure>;
    rows(schema: string, table: string, query: RowsQuery, options?: RequestOptions): Promise<RowsResult>;
    count(schema: string, table: string, where?: string, options?: RequestOptions): Promise<number>;
    cell(schema: string, table: string, key: RowKey, column: string, options?: RequestOptions): Promise<Value>;
    apply(schema: string, table: string, changes: readonly RowChange[], options?: RequestOptions): Promise<number>;
    execute(sql: string, options?: ExecuteOptions): Promise<readonly StatementResult[]>;
    close(): Promise<void>;
}

export interface DatabaseClient {
    test(config: ConnectionConfig, options?: RequestOptions): Promise<ServerInfo>;
    /* The session of this connection, the same object on every call. A connection whose config changed gets a new one, and the old one closes. */
    session(connection: Connection): DatabaseSession;
    disconnect(connectionId: string): Promise<void>;
    dispose(): Promise<void>;
}

/* A request that failed, with the code of the protocol. */
export class DatabaseRequestError extends Error {
    readonly code: DatabaseErrorCode;
    readonly sqlState: string | undefined;
    readonly change: number | undefined;

    constructor(code: DatabaseErrorCode, message: string, sqlState?: string, change?: number) {
        super(message);
        this.name = 'DatabaseRequestError';
        this.code = code;
        this.sqlState = sqlState;
        this.change = change;
    }
}
