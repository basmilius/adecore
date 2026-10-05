import { describe, expect, test } from 'bun:test';
import type { ConnectionConfig, DatabaseRequest, DatabaseResponse } from '../protocol/index.ts';
import { createDatabaseClient } from './client.ts';
import { DatabaseRequestError, type Connection, type DatabaseTransport } from './types.ts';

const config: ConnectionConfig = { engine: 'sqlite', path: '/tmp/a.db' };
const connection: Connection = { id: 'c1', name: 'Shop', config };
const SERVER = { flavor: 'sqlite', version: '3.50.4' } as const;

type Responder = (request: DatabaseRequest, calls: DatabaseRequest[]) => DatabaseResponse | Promise<DatabaseResponse> | undefined;

const ok = (id: string, result: unknown): DatabaseResponse => ({ id, ok: true, result }) as DatabaseResponse;
const err = (id: string, code: string, message = 'failed', extra: object = {}): DatabaseResponse =>
    ({ id, ok: false, error: { code, message, ...extra } }) as DatabaseResponse;

/* A transport that records every request and answers from `respond`, then from sensible defaults. */
const scripted = (respond: Responder = () => undefined) => {
    const calls: DatabaseRequest[] = [];
    let opens = 0;
    const transport: DatabaseTransport = async (request) => {
        calls.push(request);
        const custom = respond(request, calls);

        if (custom !== undefined) {
            return custom;
        }

        switch (request.method) {
            case 'open':
                return ok(request.id, { session: `s${++opens}`, server: SERVER });
            case 'close':
                return ok(request.id, null);
            case 'schemas':
                return ok(request.id, { schemas: [{ name: 'main', system: false }] });
            case 'tables':
                return ok(request.id, { tables: [] });
            case 'count':
                return ok(request.id, { count: 7 });
            case 'cell':
                return ok(request.id, { value: 'x' });
            case 'apply':
                return ok(request.id, { affected: 2 });
            case 'execute':
                return ok(request.id, { results: [] });
            case 'test':
                return ok(request.id, { server: SERVER });
            case 'cancel':
                return ok(request.id, { cancelled: true });
            default:
                return ok(request.id, { columns: [], rows: [], hasMore: false, elapsedMs: 0 });
        }
    };

    return { transport, calls, methods: () => calls.map((call) => call.method) };
};

const counterIds = () => {
    let next = 0;
    return () => `id${++next}`;
};

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const caught = async (promise: Promise<unknown>): Promise<DatabaseRequestError> => {
    try {
        await promise;
    } catch (error) {
        expect(error).toBeInstanceOf(DatabaseRequestError);
        return error as DatabaseRequestError;
    }

    throw new Error('Expected the promise to reject.');
};

describe('sessions', () => {
    test('returns the same object per connection id, and sends nothing until used', () => {
        const { transport, calls } = scripted();
        const client = createDatabaseClient(transport);
        const first = client.session(connection);
        expect(client.session({ ...connection })).toBe(first);
        expect(client.session({ ...connection, id: 'c2' })).not.toBe(first);
        expect(calls).toHaveLength(0);
    });

    test('keeps the session when only the name changes, and shows the new connection', () => {
        const { transport } = scripted();
        const client = createDatabaseClient(transport);
        const first = client.session(connection);
        const renamed = { ...connection, name: 'Shop 2', config: { ...config } };
        expect(client.session(renamed)).toBe(first);
        expect(first.connection).toBe(renamed);
    });

    test('closes the old session and returns a new one when the config changes', async () => {
        const { transport, methods, calls } = scripted();
        const client = createDatabaseClient(transport);
        const first = client.session(connection);
        await first.schemas();

        const second = client.session({ ...connection, config: { engine: 'sqlite', path: '/tmp/b.db' } });
        expect(second).not.toBe(first);
        await tick();

        expect(methods()).toEqual(['open', 'schemas', 'close']);
        expect(calls[2]!.params).toEqual({ session: 's1' });
        await second.schemas();
        expect(calls.at(-2)).toMatchObject({ method: 'open', params: { connection: { path: '/tmp/b.db' } } });
    });

    test('compares configs deeply and counts an undefined option as absent', () => {
        const { transport } = scripted();
        const client = createDatabaseClient(transport);
        const mysql: Connection = { id: 'm', name: 'M', config: { engine: 'mysql', host: 'db', user: 'root' } };
        const first = client.session(mysql);
        expect(client.session({ ...mysql, config: { engine: 'mysql', host: 'db', user: 'root', port: undefined } })).toBe(first);
        expect(client.session({ ...mysql, config: { engine: 'mysql', host: 'db', user: 'root', port: 3307 } })).not.toBe(first);
    });
});

describe('opening', () => {
    test('opens on the first request and shares one open between concurrent requests', async () => {
        const { transport, methods } = scripted();
        const session = createDatabaseClient(transport).session(connection);
        await Promise.all([session.schemas(), session.tables('main'), session.server()]);
        expect(methods().filter((method) => method === 'open')).toHaveLength(1);
        await session.schemas();
        expect(methods().filter((method) => method === 'open')).toHaveLength(1);
    });

    test('resolves the server info of the open', async () => {
        const { transport } = scripted();
        expect(await createDatabaseClient(transport).session(connection).server()).toEqual(SERVER);
    });

    test('rejects every waiter when the open fails, and tries again on the next request', async () => {
        let failing = true;
        const { transport, methods } = scripted((request) =>
            request.method === 'open' && failing ? err(request.id, 'connect-failed', 'no route') : undefined
        );
        const session = createDatabaseClient(transport).session(connection);

        const errors = await Promise.all([caught(session.schemas()), caught(session.server())]);
        expect(errors.map((error) => error.code)).toEqual(['connect-failed', 'connect-failed']);
        expect(methods()).toEqual(['open']);

        failing = false;
        expect(await session.schemas()).toHaveLength(1);
    });
});

describe('requests', () => {
    test('sends the session and the params of each method', async () => {
        const { transport, calls } = scripted();
        const session = createDatabaseClient(transport, { createId: counterIds() }).session(connection);

        await session.tables('main');
        await session.structure('main', 'users');
        await session.rows('main', 'users', { offset: 10, limit: 5, where: 'id > 1', orderBy: 'id', cellLimit: 16 });
        expect(await session.count('main', 'users')).toBe(7);
        await session.count('main', 'users', 'id > 1');
        expect(await session.cell('main', 'users', { id: 1 }, 'email')).toBe('x');
        expect(await session.apply('main', 'users', [{ kind: 'delete', key: { id: 1 } }])).toBe(2);
        await session.execute('SELECT 1', { schema: 'main', limit: 10 });

        expect<unknown>(calls.slice(1).map(({ method, params }) => [method, params])).toEqual([
            ['tables', { session: 's1', schema: 'main' }],
            ['structure', { session: 's1', schema: 'main', table: 'users' }],
            ['rows', { session: 's1', schema: 'main', table: 'users', offset: 10, limit: 5, where: 'id > 1', orderBy: 'id', cellLimit: 16 }],
            ['count', { session: 's1', schema: 'main', table: 'users' }],
            ['count', { session: 's1', schema: 'main', table: 'users', where: 'id > 1' }],
            ['cell', { session: 's1', schema: 'main', table: 'users', key: { id: 1 }, column: 'email' }],
            ['apply', { session: 's1', schema: 'main', table: 'users', changes: [{ kind: 'delete', key: { id: 1 } }] }],
            ['execute', { session: 's1', sql: 'SELECT 1', schema: 'main', limit: 10 }]
        ]);
        expect(calls.map((call) => call.id)).toEqual(['id1', 'id2', 'id3', 'id4', 'id5', 'id6', 'id7', 'id8', 'id9']);
    });

    test('makes a uuid for each request by default', async () => {
        const { transport, calls } = scripted();
        await createDatabaseClient(transport).session(connection).schemas();
        expect(calls[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
        expect(calls[1]!.id).not.toBe(calls[0]!.id);
    });

    test('turns an error response into a DatabaseRequestError', async () => {
        const { transport } = scripted((request) =>
            request.method === 'apply' ? err(request.id, 'conflict', 'The update matched no row.', { sqlState: '40001', change: 1 }) : undefined
        );
        const error = await caught(createDatabaseClient(transport).session(connection).apply('main', 'users', []));
        expect(error).toMatchObject({ name: 'DatabaseRequestError', code: 'conflict', message: 'The update matched no row.', sqlState: '40001', change: 1 });
    });

    test('turns a rejected transport into helper-unavailable', async () => {
        const client = createDatabaseClient(async () => {
            throw new Error('channel closed');
        });
        const error = await caught(client.session(connection).schemas());
        expect(error).toMatchObject({ code: 'helper-unavailable', message: 'channel closed' });
        expect(await caught(client.test(config))).toMatchObject({ code: 'helper-unavailable' });
    });

    test('turns a transport that throws at once into helper-unavailable', async () => {
        const client = createDatabaseClient(() => {
            throw new Error('no bridge');
        });
        expect(await caught(client.session(connection).schemas())).toMatchObject({ code: 'helper-unavailable', message: 'no bridge' });
    });

    test('tests a config without a session', async () => {
        const { transport, calls } = scripted();
        expect(await createDatabaseClient(transport).test(config)).toEqual(SERVER);
        expect(calls[0]).toMatchObject({ method: 'test', params: { connection: config } });
    });
});

describe('unknown-session', () => {
    test.each(['schemas', 'tables', 'structure', 'rows', 'count', 'cell'] as const)('opens again and retries %s once', async (method) => {
        let first = true;
        const { transport, methods, calls } = scripted((request) => {
            if (request.method === method && first) {
                first = false;
                return err(request.id, 'unknown-session');
            }
        });
        const session = createDatabaseClient(transport).session(connection);
        const run = {
            schemas: () => session.schemas(),
            tables: () => session.tables('main'),
            structure: () => session.structure('main', 't'),
            rows: () => session.rows('main', 't', { offset: 0, limit: 1 }),
            count: () => session.count('main', 't'),
            cell: () => session.cell('main', 't', { id: 1 }, 'a')
        };

        await run[method]();

        expect(methods()).toEqual(['open', method, 'open', method]);
        expect((calls[1]!.params as { session: string }).session).toBe('s1');
        expect((calls[3]!.params as { session: string }).session).toBe('s2');
    });

    test('retries only once', async () => {
        const { transport, methods } = scripted((request) => (request.method === 'schemas' ? err(request.id, 'unknown-session') : undefined));
        const error = await caught(createDatabaseClient(transport).session(connection).schemas());
        expect(error.code).toBe('unknown-session');
        expect(methods()).toEqual(['open', 'schemas', 'open', 'schemas']);
    });

    test('shares the reopen between reads that fail together', async () => {
        const stale = new Set(['s1']);
        const { transport, methods } = scripted((request) => {
            const session = (request.params as { session?: string }).session;
            return session !== undefined && stale.has(session) && request.method !== 'close' ? err(request.id, 'unknown-session') : undefined;
        });
        const session = createDatabaseClient(transport).session(connection);
        await session.server();
        await Promise.all([session.schemas(), session.tables('main')]);
        expect(methods().filter((method) => method === 'open')).toHaveLength(2);
    });

    for (const method of ['apply', 'execute'] as const) {
        test(`${method} rejects with the original error and opens again for the next request`, async () => {
            let first = true;
            const { transport, methods } = scripted((request) => {
                if (request.method === method && first) {
                    first = false;
                    return err(request.id, 'unknown-session', 'gone');
                }
            });
            const session = createDatabaseClient(transport).session(connection);
            const run = () => (method === 'apply' ? session.apply('main', 't', []) : session.execute('SELECT 1'));

            expect(await caught(run())).toMatchObject({ code: 'unknown-session', message: 'gone' });
            expect(methods()).toEqual(['open', method]);

            await run();
            expect(methods()).toEqual(['open', method, 'open', method]);
        });
    }
});

describe('abort', () => {
    test('rejects with cancelled without sending when already aborted', async () => {
        const { transport, calls } = scripted();
        const session = createDatabaseClient(transport).session(connection);
        const error = await caught(session.schemas({ signal: AbortSignal.abort() }));
        expect(error.code).toBe('cancelled');
        expect(calls).toHaveLength(0);
        expect((await caught(session.execute('SELECT 1', { signal: AbortSignal.abort() }))).code).toBe('cancelled');
        expect((await caught(createDatabaseClient(transport).test(config, { signal: AbortSignal.abort() }))).code).toBe('cancelled');
        expect(calls).toHaveLength(0);
    });

    test('sends a cancel for the request and rejects at once while it is in flight', async () => {
        let release: (response: DatabaseResponse) => void = () => {};
        const { transport, calls, methods } = scripted((request) =>
            request.method === 'rows' ? new Promise<DatabaseResponse>((resolve) => (release = resolve)) : undefined
        );
        const session = createDatabaseClient(transport, { createId: counterIds() }).session(connection);
        await session.server();

        const controller = new AbortController();
        const pending = caught(session.rows('main', 't', { offset: 0, limit: 1 }, { signal: controller.signal }));
        await tick();
        controller.abort();

        expect((await pending).code).toBe('cancelled');
        expect(methods()).toEqual(['open', 'rows', 'cancel']);
        expect(calls[2]!.params).toEqual({ request: calls[1]!.id });
        expect(calls[2]!.id).not.toBe(calls[1]!.id);

        release(err(calls[1]!.id, 'cancelled'));
    });

    test('ignores the outcome of the cancel', async () => {
        const { transport } = scripted((request) => {
            if (request.method === 'cancel') {
                throw new Error('no channel');
            }
            return request.method === 'rows' ? new Promise<DatabaseResponse>(() => {}) : undefined;
        });
        const session = createDatabaseClient(transport).session(connection);
        const controller = new AbortController();
        const pending = caught(session.rows('main', 't', { offset: 0, limit: 1 }, { signal: controller.signal }));
        await tick();
        controller.abort();
        expect((await pending).code).toBe('cancelled');
    });

    test('stops waiting for an open without cancelling the open for the others', async () => {
        let release: (response: DatabaseResponse) => void = () => {};
        const { transport, methods } = scripted((request) =>
            request.method === 'open' ? new Promise<DatabaseResponse>((resolve) => (release = resolve)) : undefined
        );
        const session = createDatabaseClient(transport, { createId: counterIds() }).session(connection);
        const controller = new AbortController();
        const aborted = caught(session.schemas({ signal: controller.signal }));
        const patient = session.tables('main');
        await tick();
        controller.abort();

        expect((await aborted).code).toBe('cancelled');
        release(ok('id1', { session: 's1', server: SERVER }));
        await patient;
        expect(methods()).toEqual(['open', 'tables']);
    });

    test('removes its listener once the request is answered', async () => {
        const { transport, methods } = scripted();
        const session = createDatabaseClient(transport).session(connection);
        const controller = new AbortController();
        await session.schemas({ signal: controller.signal });
        controller.abort();
        await tick();
        expect(methods()).toEqual(['open', 'schemas']);
    });
});

describe('closing', () => {
    test('close sends a close for the open session and drops it from the cache', async () => {
        const { transport, methods, calls } = scripted();
        const client = createDatabaseClient(transport);
        const session = client.session(connection);
        await session.schemas();
        await session.close();

        expect(methods()).toEqual(['open', 'schemas', 'close']);
        expect(calls[2]!.params).toEqual({ session: 's1' });
        expect(client.session(connection)).not.toBe(session);
    });

    test('close sends nothing for a session that never opened, and swallows a failing close', async () => {
        const never = scripted();
        const idle = createDatabaseClient(never.transport);
        await idle.session(connection).close();
        expect(never.calls).toHaveLength(0);

        const failing = scripted((request) => (request.method === 'close' ? err(request.id, 'unknown-session') : undefined));
        const client = createDatabaseClient(failing.transport);
        const session = client.session(connection);
        await session.schemas();
        await session.close();
    });

    test('close waits for an open that is in flight and closes what it opened', async () => {
        let release: (response: DatabaseResponse) => void = () => {};
        const { transport, methods } = scripted((request) =>
            request.method === 'open' ? new Promise<DatabaseResponse>((resolve) => (release = resolve)) : undefined
        );
        const session = createDatabaseClient(transport, { createId: counterIds() }).session(connection);
        const opening = caught(session.schemas());
        await tick();
        const closing = session.close();
        release(ok('id1', { session: 's9', server: SERVER }));
        await closing;
        await opening.catch(() => {});
        expect(methods()).toContain('close');
    });

    test('disconnect closes one connection and dispose closes all', async () => {
        const { transport, calls } = scripted();
        const client = createDatabaseClient(transport);
        const one = client.session(connection);
        const two = client.session({ ...connection, id: 'c2' });
        const three = client.session({ ...connection, id: 'c3' });
        await Promise.all([one.schemas(), two.schemas(), three.schemas()]);

        await client.disconnect('c1');
        expect(calls.filter((call) => call.method === 'close')).toHaveLength(1);
        expect(client.session(connection)).not.toBe(one);

        await client.dispose();
        expect(calls.filter((call) => call.method === 'close')).toHaveLength(3);
        expect(client.session({ ...connection, id: 'c2' })).not.toBe(two);
        await client.disconnect('unknown');
    });
});
