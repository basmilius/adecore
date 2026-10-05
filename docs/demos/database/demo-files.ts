import type { DatabaseClient, DatabaseFiles, DatabaseSession, ExportRequest, ImportRequest, RequestOptions } from '@adecore/database';
import type { RowChange } from '@adecore/database/protocol';

/* The one file the demo opens: three new customers, as a person would export them from another tool. */
const CUSTOMERS_PATH = '/Users/demo/Downloads/new-customers.csv';
const CUSTOMERS = [
    ['name', 'email', 'country'],
    ['Ingrid Larsen', 'ingrid@example.no', 'NO'],
    ['Jonas Weber', 'jonas@example.ch', 'CH'],
    ['Kenji Sato', 'kenji@example.jp', '']
];

/* What a dialog of the app would answer: the Downloads folder for a save, the file above for an open. */
export const DEMO_FILES: DatabaseFiles = {
    save: async ({ suggestedName }) => `/Users/demo/Downloads/${suggestedName}`,
    open: async () => CUSTOMERS_PATH
};

const linesOf = (header: boolean): readonly (readonly string[])[] => (header ? CUSTOMERS.slice(1) : CUSTOMERS);

const sample = async (_path: string, _format: 'csv' | 'tsv', header: boolean) => ({
    columns: header ? CUSTOMERS[0]! : CUSTOMERS[0]!.map((_name, i) => `column${i + 1}`),
    rows: linesOf(header)
});

/*
 * The in-memory fake has no files, so this answers the file methods in the page instead: an export writes
 * nothing and reports the rows a real one would write, and an import inserts the lines above with `apply`.
 */
const withFiles = (session: DatabaseSession): DatabaseSession => {
    const exportRows = async (request: ExportRequest, options?: RequestOptions) => {
        const source = request.source;
        const rows =
            source.kind === 'table'
                ? await session.count(source.schema, source.table, source.where, options)
                : (await session.page(source.sql, { schema: source.schema, offset: 0, limit: 10000 }, options)).rows.length;
        return { rows, bytes: 0, elapsedMs: 0 };
    };

    const importRows = (schema: string, table: string, request: ImportRequest, options?: RequestOptions): Promise<number> => {
        const changes = linesOf(request.header).map((line): RowChange => ({
            kind: 'insert',
            values: Object.fromEntries(request.columns.flatMap((column, i) => (column === null ? [] : [[column, line[i] === '' ? null : line[i]!]])))
        }));
        return session.apply(schema, table, changes, options);
    };

    return new Proxy(session, {
        get: (target, key) => (key === 'export' ? exportRows : key === 'import' ? importRows : Reflect.get(target, key))
    });
};

/* A client whose sessions take files, for the demos of export and import. */
export const withDemoFiles = (client: DatabaseClient): DatabaseClient => {
    const wrapped = new WeakMap<DatabaseSession, DatabaseSession>();

    return {
        ...client,
        sample,
        session: (connection, channel) => {
            const session = client.session(connection, channel);
            let found = wrapped.get(session);
            if (found === undefined) {
                found = withFiles(session);
                wrapped.set(session, found);
            }
            return found;
        }
    };
};
