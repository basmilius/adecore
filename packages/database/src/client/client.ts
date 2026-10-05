import type { ConnectionConfig, DatabaseMethod, DatabaseParams, DatabaseRequest, DatabaseResult, ServerInfo } from '../protocol/index.ts';
import {
    DatabaseRequestError,
    type Connection,
    type DatabaseClient,
    type DatabaseSession,
    type DatabaseTransport,
    type ExecuteOptions,
    type RequestOptions
} from './types.ts';

export interface DatabaseClientOptions {
    /* Makes the id of a request. `crypto.randomUUID()` when left out. */
    readonly createId?: () => string;
}

interface Opened {
    readonly session: string;
    readonly server: ServerInfo;
}

const cancelledError = (): DatabaseRequestError => new DatabaseRequestError('cancelled', 'The request was cancelled.');

const isUnknownSession = (error: unknown): boolean => error instanceof DatabaseRequestError && error.code === 'unknown-session';

/* Structural equality for the JSON a config is made of; a key set to `undefined` counts as absent. */
const isEqual = (left: unknown, right: unknown): boolean => {
    if (left === right) {
        return true;
    }

    if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
        return false;
    }

    const leftKeys = Object.keys(left).filter((key) => (left as Record<string, unknown>)[key] !== undefined);
    const rightKeys = Object.keys(right).filter((key) => (right as Record<string, unknown>)[key] !== undefined);

    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every((key) => isEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]))
    );
};

/* Rejects with `cancelled` as soon as the signal aborts, without waiting for the promise. */
const raceAbort = <T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> => {
    if (signal === undefined) {
        return promise;
    }

    if (signal.aborted) {
        promise.catch(() => {});
        return Promise.reject(cancelledError());
    }

    return new Promise<T>((resolve, reject) => {
        const onAbort = (): void => reject(cancelledError());
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
};

export const createDatabaseClient = (transport: DatabaseTransport, options: DatabaseClientOptions = {}): DatabaseClient => {
    const createId = options.createId ?? (() => crypto.randomUUID());
    const live = new Map<string, ReturnType<typeof createSession>>();

    const send = async <M extends DatabaseMethod>(method: M, params: DatabaseParams<M>, signal?: AbortSignal): Promise<DatabaseResult<M>> => {
        if (signal?.aborted) {
            throw cancelledError();
        }

        const id = createId();
        const request = { id, method, params } as DatabaseRequest;

        return new Promise<DatabaseResult<M>>((resolve, reject) => {
            const onAbort = (): void => {
                const cancel = { id: createId(), method: 'cancel', params: { request: id } } as DatabaseRequest;
                new Promise((done) => done(transport(cancel))).catch(() => {});
                reject(cancelledError());
            };

            signal?.addEventListener('abort', onAbort, { once: true });

            new Promise((done) => done(transport(request)))
                .then(
                    (response) => {
                        const { ok, result, error } = response as {
                            ok: boolean;
                            result?: unknown;
                            error?: { code: never; message: string; sqlState?: string; change?: number };
                        };

                        if (ok) {
                            resolve(result as DatabaseResult<M>);
                        } else {
                            reject(new DatabaseRequestError(error!.code, error!.message, error!.sqlState, error!.change));
                        }
                    },
                    (error: unknown) => reject(new DatabaseRequestError('helper-unavailable', error instanceof Error ? error.message : String(error)))
                )
                .finally(() => signal?.removeEventListener('abort', onAbort));
        });
    };

    const createSession = (initial: Connection) => {
        let connection = initial;
        let opened: Opened | null = null;
        let opening: Promise<Opened> | null = null;

        const open = (): Promise<Opened> => {
            if (opened !== null) {
                return Promise.resolve(opened);
            }

            opening ??= send('open', { connection: connection.config })
                .then((result) => (opened = result))
                .finally(() => {
                    opening = null;
                });

            return opening;
        };

        /* Reads are safe to send twice, so they open again and retry once; a write is not, so it only drops the session. */
        const request = async <M extends DatabaseMethod>(
            method: M,
            build: (session: string) => DatabaseParams<M>,
            requestOptions: RequestOptions | undefined,
            retry: boolean
        ): Promise<DatabaseResult<M>> => {
            const signal = requestOptions?.signal;

            if (signal?.aborted) {
                throw cancelledError();
            }

            const current = await raceAbort(open(), signal);

            try {
                return await send(method, build(current.session), signal);
            } catch (error) {
                if (!isUnknownSession(error)) {
                    throw error;
                }

                if (opened === current) {
                    opened = null;
                }

                if (retry) {
                    return request(method, build, requestOptions, false);
                }

                throw error;
            }
        };

        const close = async (): Promise<void> => {
            if (live.get(connection.id) === created) {
                live.delete(connection.id);
            }

            const current = opened ?? (opening === null ? null : await opening.catch(() => null));
            opened = null;

            if (current !== null) {
                await send('close', { session: current.session }).catch(() => {});
            }
        };

        const session: DatabaseSession = {
            get connection() {
                return connection;
            },
            async server(requestOptions) {
                return (await raceAbort(open(), requestOptions?.signal)).server;
            },
            async schemas(requestOptions) {
                return (await request('schemas', (id) => ({ session: id }), requestOptions, true)).schemas;
            },
            async tables(schema, requestOptions) {
                return (await request('tables', (id) => ({ session: id, schema }), requestOptions, true)).tables;
            },
            structure(schema, table, requestOptions) {
                return request('structure', (id) => ({ session: id, schema, table }), requestOptions, true);
            },
            rows(schema, table, query, requestOptions) {
                return request('rows', (id) => ({ session: id, schema, table, ...query }), requestOptions, true);
            },
            async count(schema, table, where, requestOptions) {
                const params = (id: string) => (where === undefined ? { session: id, schema, table } : { session: id, schema, table, where });
                return (await request('count', params, requestOptions, true)).count;
            },
            async cell(schema, table, key, column, requestOptions) {
                return (await request('cell', (id) => ({ session: id, schema, table, key, column }), requestOptions, true)).value;
            },
            async apply(schema, table, changes, requestOptions) {
                return (await request('apply', (id) => ({ session: id, schema, table, changes }), requestOptions, false)).affected;
            },
            async execute(sql, executeOptions?: ExecuteOptions) {
                const { signal: _signal, ...rest } = executeOptions ?? {};
                return (await request('execute', (id) => ({ session: id, sql, ...rest }), executeOptions, false)).results;
            },
            close
        };

        const created = {
            session,
            close,
            update(next: Connection): void {
                connection = next;
            }
        };
        return created;
    };

    return {
        test(config: ConnectionConfig, requestOptions?: RequestOptions) {
            return send('test', { connection: config }, requestOptions?.signal).then((result) => result.server);
        },
        session(connection) {
            const existing = live.get(connection.id);

            if (existing !== undefined && isEqual(existing.session.connection.config, connection.config)) {
                existing.update(connection);
                return existing.session;
            }

            void existing?.close();

            const created = createSession(connection);
            live.set(connection.id, created);
            return created.session;
        },
        async disconnect(connectionId) {
            const existing = live.get(connectionId);
            live.delete(connectionId);
            await existing?.close();
        },
        async dispose() {
            const all = [...live.values()];
            live.clear();
            await Promise.all(all.map((entry) => entry.close()));
        }
    };
};
