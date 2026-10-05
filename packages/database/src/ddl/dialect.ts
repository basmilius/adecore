import type { Engine, ServerInfo } from '../protocol/index.ts';
import { qualifiedName, quoteIdentifier } from '../sql.ts';

/* The SQL a server speaks: the engine picks the quoting and the shape of a statement, the version what that server can do without a rebuild. */
export interface Dialect {
    readonly flavor: ServerInfo['flavor'];
    readonly engine: Engine;
    /* The numbers of the version, such as `[3, 45, 1]`; empty when the server's text holds none. */
    readonly version: readonly number[];
}

const VERSION = /(\d+(?:\.\d+)*)/;

export const dialectOf = (server: ServerInfo): Dialect => ({
    flavor: server.flavor,
    engine: server.flavor === 'sqlite' ? 'sqlite' : 'mysql',
    version: (VERSION.exec(server.version)?.[1] ?? '')
        .split('.')
        .filter((part) => part !== '')
        .map(Number)
});

/* Whether the server is at least this version. A version nobody could read counts as new enough. */
export const atLeast = (dialect: Dialect, ...wanted: number[]): boolean => {
    if (dialect.version.length === 0) {
        return true;
    }
    for (let i = 0; i < wanted.length; i++) {
        const have = dialect.version[i] ?? 0;
        if (have !== wanted[i]) {
            return have > wanted[i]!;
        }
    }
    return true;
};

export const quote = (dialect: Dialect, name: string): string => quoteIdentifier(dialect.engine, name);

/* SQLite reads an unqualified name as `main`, so only an attached schema is spelled out. */
const schemaOf = (dialect: Dialect, schema: string): string | undefined =>
    schema === '' || (dialect.engine === 'sqlite' && schema === 'main') ? undefined : schema;

/* A table with its schema in front, when the statement needs one. */
export const tableName = (dialect: Dialect, schema: string, table: string): string =>
    qualifiedName({ engine: dialect.engine, table, schema: schemaOf(dialect, schema) });

/* SQLite puts the schema in front of the name of an index, where MySQL names the table it is on. */
export const sqliteSchemaPrefix = (dialect: Dialect, schema: string): string => {
    const named = schemaOf(dialect, schema);
    return named === undefined ? '' : `${quote(dialect, named)}.`;
};

export const columnList = (dialect: Dialect, columns: readonly string[]): string => columns.map((column) => quote(dialect, column)).join(', ');
