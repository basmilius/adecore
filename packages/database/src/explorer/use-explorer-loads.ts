import { useEffect, useRef, useState } from 'react';
import { messageOf } from '@adecore/ui';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import type { SchemaInfo, TableInfo } from '../protocol/index.ts';
import { IDLE, connectionKey, loadKey, schemaKey, type Load, type LoadTarget } from './tree.ts';

interface Loads {
    readonly schemas: ReadonlyMap<string, Load<readonly SchemaInfo[]>>;
    readonly tables: ReadonlyMap<string, Load<readonly TableInfo[]>>;
}

const EMPTY: Loads = { schemas: new Map(), tables: new Map() };

export interface ExplorerLoads {
    schemas(connectionId: string): Load<readonly SchemaInfo[]>;
    tables(connectionId: string, schema: string): Load<readonly TableInfo[]>;
    /* Starts a load nobody has started yet; a no-op for one that is running or done. */
    start(target: LoadTarget): void;
    /* Forgets what was loaded under a connection, or only under one schema, so an open node asks again. */
    reset(target: LoadTarget): void;
}

/* The schemas and tables the explorer has asked a session for, by connection and schema. */
export function useExplorerLoads(connections: readonly Connection[]): ExplorerLoads {
    const client = useDatabaseClient();
    const [loads, setLoads] = useState<Loads>(EMPTY);
    // Written before the state is, so a strict-mode second effect run does not fetch twice.
    const started = useRef(new Set<string>());
    const configs = useRef(new Map<string, Connection['config']>());

    const store = (target: LoadTarget, load: Load<readonly SchemaInfo[]> | Load<readonly TableInfo[]>): void => {
        setLoads((current) => {
            if (target.schema === undefined) {
                return { ...current, schemas: new Map(current.schemas).set(target.connectionId, load as Load<readonly SchemaInfo[]>) };
            }
            return { ...current, tables: new Map(current.tables).set(schemaKey(target.connectionId, target.schema), load as Load<readonly TableInfo[]>) };
        });
    };

    const reset = (target: LoadTarget): void => {
        const prefix = connectionKey(target.connectionId);
        const tablesPrefix = `s:${target.connectionId}\u0000`;
        const owns = (key: string): boolean => (target.schema === undefined ? key === prefix || key.startsWith(tablesPrefix) : key === loadKey(target));
        for (const key of [...started.current].filter(owns)) {
            started.current.delete(key);
        }
        setLoads((current) => ({
            schemas: new Map([...current.schemas].filter(([id]) => target.schema !== undefined || id !== target.connectionId)),
            tables: new Map([...current.tables].filter(([key]) => !owns(key)))
        }));
    };

    const start = (target: LoadTarget): void => {
        const key = loadKey(target);
        if (started.current.has(key)) {
            return;
        }
        const connection = connections.find((entry) => entry.id === target.connectionId);
        if (connection === undefined) {
            return;
        }
        started.current.add(key);
        store(target, { status: 'loading' });
        const session = client.session(connection);
        const request: Promise<readonly SchemaInfo[] | readonly TableInfo[]> = target.schema === undefined ? session.schemas() : session.tables(target.schema);
        request.then(
            (value) => store(target, { status: 'ready', value } as Load<readonly SchemaInfo[]> | Load<readonly TableInfo[]>),
            (e: unknown) => store(target, { status: 'error', message: messageOf(e) })
        );
    };

    // A connection that was edited or removed is a different session, so what it listed is stale.
    useEffect(() => {
        const known = configs.current;
        for (const [id, config] of known) {
            const now = connections.find((entry) => entry.id === id);
            if (now === undefined || now.config !== config) {
                known.delete(id);
                reset({ connectionId: id });
            }
        }
        for (const connection of connections) {
            known.set(connection.id, connection.config);
        }
    });

    return {
        schemas: (connectionId) => loads.schemas.get(connectionId) ?? IDLE,
        tables: (connectionId, schema) => loads.tables.get(schemaKey(connectionId, schema)) ?? IDLE,
        start,
        reset
    };
}
