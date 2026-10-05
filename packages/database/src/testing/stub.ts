import type { Connection, DatabaseClient, DatabaseSession } from '../client/types.ts';

const refuse = <T>(): Promise<T> => Promise.reject(new Error('stub'));

/* A client for a render test that never reaches the server; whatever a test needs it overrides. Internal: not exported from the testing entry. */
export const stubClient = (overrides: Partial<DatabaseClient> = {}): DatabaseClient => ({
    test: refuse,
    discover: refuse,
    sample: refuse,
    notifySchemaChange: () => {},
    onSchemaChange: () => () => {},
    session: () => {
        throw new Error('stub');
    },
    disconnect: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
    ...overrides
});

/* A session whose requests never settle, which is what a view shows while it loads. */
export const stubSession = (connection: Connection, overrides: Partial<DatabaseSession> = {}): DatabaseSession => {
    const pending = <T>(): Promise<T> => new Promise<T>(() => {});

    return {
        connection,
        server: pending,
        schemas: pending,
        tables: pending,
        structure: pending,
        rows: pending,
        count: pending,
        cell: pending,
        apply: pending,
        execute: pending,
        page: pending,
        transaction: pending,
        export: pending,
        import: pending,
        close: () => Promise.resolve(),
        ...overrides
    };
};
