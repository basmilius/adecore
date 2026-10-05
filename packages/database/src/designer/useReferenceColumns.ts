import { useEffect, useState } from 'react';
import type { Connection, DatabaseClient } from '../client/types.ts';
import type { TableDraft } from '../ddl/index.ts';

interface Cache {
    readonly scope: string;
    readonly columns: Readonly<Record<string, readonly string[]>>;
}

/*
 * The columns of the tables the draft's foreign keys point at, loaded as they are picked. `scope`
 * is the connection and the schema, so a cache never answers for another. A table that fails to
 * load has no columns to pick from, which stops the wait.
 */
export function useReferenceColumns(
    client: DatabaseClient,
    connection: Connection,
    schema: string,
    draft: TableDraft
): (table: string) => readonly string[] | null {
    const scope = `${connection.id}\u0000${schema}`;
    const [cache, setCache] = useState<Cache>({ scope, columns: {} });
    const known = cache.scope === scope ? cache.columns : {};
    const wanted = [...new Set(draft.foreignKeys.map((foreignKey) => foreignKey.referencedTable))]
        .filter((table) => table !== '' && table !== draft.name && !(table in known))
        .sort();
    const wantedKey = wanted.join('\u0000');

    useEffect(() => {
        if (wantedKey === '') {
            return undefined;
        }
        let current = true;
        const session = client.session(connection);
        for (const table of wantedKey.split('\u0000')) {
            session
                .structure(schema, table)
                .then(
                    (structure) => structure.columns.map((column) => column.name),
                    () => []
                )
                .then((names) => {
                    if (current) {
                        setCache((now) => ({ scope, columns: { ...(now.scope === scope ? now.columns : {}), [table]: names } }));
                    }
                });
        }
        return () => {
            current = false;
        };
    }, [client, connection, schema, scope, wantedKey]);

    return (table) => (table === draft.name ? draft.columns.map((column) => column.name) : (known[table] ?? null));
}
