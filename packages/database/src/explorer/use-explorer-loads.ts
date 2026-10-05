import { useEffect, useRef, useState } from 'react';
import { messageOf } from '@adecore/ui';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection, SchemaChange } from '../client/types.ts';
import type { SchemaInfo, TableInfo, TableStructure } from '../protocol/index.ts';
import { IDLE, loadKey, type Load, type LoadTarget } from './tree.ts';

type Loaded = readonly SchemaInfo[] | readonly TableInfo[] | TableStructure;

interface Entry {
    readonly target: LoadTarget;
    readonly load: Load<Loaded>;
}

interface Loads {
    readonly entries: ReadonlyMap<string, Entry>;
    /* The version each server reported, by connection. */
    readonly versions: ReadonlyMap<string, string>;
}

const EMPTY: Loads = { entries: new Map(), versions: new Map() };

export interface ExplorerLoads {
    schemas(connectionId: string): Load<readonly SchemaInfo[]>;
    tables(connectionId: string, schema: string): Load<readonly TableInfo[]>;
    structures(connectionId: string, schema: string, table: string): Load<TableStructure>;
    /* The server version of a connection, once its schemas have loaded; `null` before. */
    versions(connectionId: string): string | null;
    /* Starts a load nobody has started yet; a no-op for one that is running or done. */
    start(target: LoadTarget): void;
    /* Forgets what was loaded under a connection, under one schema, or for one table, so an open node asks again. */
    reset(target: LoadTarget): void;
}

/* Whether a load belongs to what a reset names: the same connection, and the same schema or table when the reset names one. */
const within = (reset: LoadTarget, target: LoadTarget): boolean =>
    reset.connectionId === target.connectionId &&
    (reset.schema === undefined || reset.schema === target.schema) &&
    (reset.table === undefined || reset.table === target.table);

/* A change to a schema also changes the schema list, and one without a schema changes every list of the connection. */
const touches = (change: SchemaChange, target: LoadTarget): boolean =>
    change.connectionId === target.connectionId && (change.schema === undefined || target.schema === undefined || change.schema === target.schema);

/* The schemas, tables and column lists the explorer has asked a session for, by connection, schema and table. */
export function useExplorerLoads(connections: readonly Connection[]): ExplorerLoads {
    const client = useDatabaseClient();
    const [loads, setLoads] = useState<Loads>(EMPTY);
    // Written before the state is, so a strict-mode second effect run does not fetch twice.
    const started = useRef(new Map<string, LoadTarget>());
    const configs = useRef(new Map<string, Connection['config']>());

    const store = (target: LoadTarget, load: Load<Loaded>): void => {
        setLoads((current) => ({ ...current, entries: new Map(current.entries).set(loadKey(target), { target, load }) }));
    };

    const reset = (target: LoadTarget): void => {
        for (const [key, began] of [...started.current]) {
            if (within(target, began)) {
                started.current.delete(key);
            }
        }
        setLoads((current) => ({
            entries: new Map([...current.entries].filter(([, entry]) => !within(target, entry.target))),
            versions: target.schema === undefined ? new Map([...current.versions].filter(([id]) => id !== target.connectionId)) : current.versions
        }));
    };

    /* A silent load keeps showing what it replaces, so a reload does not blink the tree. */
    const run = (target: LoadTarget, connection: Connection, silent: boolean): void => {
        if (!silent) {
            store(target, { status: 'loading' });
        }
        const session = client.session(connection);
        const request: Promise<Loaded> =
            target.schema === undefined
                ? session.schemas()
                : target.table === undefined
                  ? session.tables(target.schema)
                  : session.structure(target.schema, target.table);
        request.then(
            (value) => {
                store(target, { status: 'ready', value });
                if (target.schema === undefined) {
                    // Chained after the schemas so the version never opens a session by itself.
                    session.server().then(
                        (info) => setLoads((current) => ({ ...current, versions: new Map(current.versions).set(connection.id, info.version) })),
                        () => undefined
                    );
                }
            },
            (e: unknown) => store(target, { status: 'error', message: messageOf(e) })
        );
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
        started.current.set(key, target);
        run(target, connection, false);
    };

    /* Lists load again in place and column lists are dropped, since the table they describe may be gone; an open table asks again by itself. */
    const reload = (change: SchemaChange): void => {
        const connection = connections.find((entry) => entry.id === change.connectionId);
        const dropped: LoadTarget[] = [];
        for (const [key, began] of [...started.current]) {
            if (!touches(change, began)) {
                continue;
            }
            if (began.table !== undefined) {
                started.current.delete(key);
                dropped.push(began);
            } else if (connection !== undefined) {
                run(began, connection, true);
            }
        }
        if (dropped.length > 0) {
            const gone = new Set(dropped.map(loadKey));
            setLoads((current) => ({ ...current, entries: new Map([...current.entries].filter(([key]) => !gone.has(key))) }));
        }
    };

    useEffect(() => client.onSchemaChange(reload));

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

    const loadOf = <T extends Loaded>(target: LoadTarget): Load<T> => (loads.entries.get(loadKey(target))?.load as Load<T> | undefined) ?? IDLE;

    return {
        schemas: (connectionId) => loadOf<readonly SchemaInfo[]>({ connectionId }),
        tables: (connectionId, schema) => loadOf<readonly TableInfo[]>({ connectionId, schema }),
        structures: (connectionId, schema, table) => loadOf<TableStructure>({ connectionId, schema, table }),
        versions: (connectionId) => loads.versions.get(connectionId) ?? null,
        start,
        reset
    };
}
