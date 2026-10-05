import { describe, expect, test } from 'bun:test';
import { createDatabaseClient } from '../client/index.ts';
import type { ColumnInfo, Value } from '../protocol/index.ts';
import { fakeDatabaseTransport, type FakeDatabase } from './index.ts';

const column = (name: string, kind: ColumnInfo['kind'], extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
    name,
    type: kind.toUpperCase(),
    kind,
    nullable: false,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null,
    ...extra
});

const users = [
    column('id', 'integer', { autoIncrement: true }),
    column('email', 'text'),
    column('avatar', 'binary', { nullable: true }),
    column('created_at', 'text', { defaultValue: 'CURRENT_TIMESTAMP' }),
    column('role', 'text', { defaultValue: "'member'" })
];

const rows = (): Value[][] => [
    [1, 'a@example.com', null, '2026-10-01 10:00:00', 'admin'],
    [2, 'b'.repeat(40) + '@example.com', { kind: 'binary', hex: '89504e470d0a1a0a' }, '2026-10-02 10:00:00', 'member'],
    [3, 'c@example.com', null, '2026-10-03 10:00:00', 'member']
];

const database = (): FakeDatabase => ({
    schemas: {
        main: {
            users: {
                columns: users,
                primaryKey: ['id'],
                rows: rows(),
                ddl: 'CREATE TABLE users (...)',
                indexes: [{ name: 'users_email', columns: ['email'], unique: true, primary: false }]
            },
            notes: { columns: [column('body', 'text')], rows: [['one'], ['two']] },
            active_users: { kind: 'view', columns: users, rows: [] }
        },
        archive: { old: { columns: [column('id', 'integer')], rows: [[1]] } }
    }
});

const setup = (options: { latencyMs?: number; readOnly?: boolean } = {}) => {
    const data = database();
    const client = createDatabaseClient(fakeDatabaseTransport({ databases: { '/tmp/shop.db': data, db: data }, latencyMs: options.latencyMs }));
    const session = client.session({ id: 'c', name: 'Shop', config: { engine: 'sqlite', path: '/tmp/shop.db', readOnly: options.readOnly } });
    return { client, session, data };
};

describe('opening', () => {
    test('picks a database by sqlite path or mysql host', async () => {
        const { client } = setup();
        expect(await client.session({ id: 'a', name: 'a', config: { engine: 'sqlite', path: '/tmp/shop.db' } }).server()).toEqual({
            flavor: 'sqlite',
            version: '3.50.4'
        });
        expect((await client.session({ id: 'b', name: 'b', config: { engine: 'mysql', host: 'db', user: 'root' } }).server()).flavor).toBe('mysql');
        expect(await client.test({ engine: 'sqlite', path: '/tmp/shop.db' })).toMatchObject({ flavor: 'sqlite' });
    });

    test('fails with connect-failed for an unknown database', async () => {
        const { client } = setup();
        const missing = client.session({ id: 'x', name: 'x', config: { engine: 'sqlite', path: '/nowhere.db' } });
        await expect(missing.server()).rejects.toMatchObject({ code: 'connect-failed' });
        await expect(client.test({ engine: 'mysql', host: 'unknown', user: 'root' })).rejects.toMatchObject({ code: 'connect-failed' });
    });

    test('reports the server of the options', async () => {
        const server = { flavor: 'mariadb', version: '11.4.2-MariaDB' } as const;
        const client = createDatabaseClient(fakeDatabaseTransport({ databases: { db: database() }, server }));
        expect(await client.session({ id: 'a', name: 'a', config: { engine: 'mysql', host: 'db', user: 'root' } }).server()).toEqual(server);
    });
});

describe('reading', () => {
    test('lists schemas, tables and the structure', async () => {
        const { session } = setup();
        expect(await session.schemas()).toEqual([
            { name: 'main', system: false },
            { name: 'archive', system: false }
        ]);
        expect((await session.tables('main')).map(({ name, kind, rowEstimate }) => [name, kind, rowEstimate])).toEqual([
            ['users', 'table', 3],
            ['notes', 'table', 2],
            ['active_users', 'view', 0]
        ]);

        const users = await session.structure('main', 'users');
        expect(users).toMatchObject({ schema: 'main', name: 'users', primaryKey: ['id'], rowKey: ['id'], ddl: 'CREATE TABLE users (...)' });
        expect((await session.structure('main', 'notes')).rowKey).toBeNull();
        await expect(session.structure('main', 'missing')).rejects.toMatchObject({ code: 'query-failed', sqlState: '42S02' });
        await expect(session.tables('nope')).rejects.toMatchObject({ code: 'query-failed' });
    });

    test('uses a unique index over columns that cannot be null as the row key', async () => {
        const client = createDatabaseClient(
            fakeDatabaseTransport({
                databases: {
                    db: {
                        schemas: {
                            main: {
                                t: { columns: [column('email', 'text')], rows: [], indexes: [{ name: 'u', columns: ['email'], unique: true, primary: false }] }
                            }
                        }
                    }
                }
            })
        );
        expect((await client.session({ id: 'a', name: 'a', config: { engine: 'mysql', host: 'db', user: 'u' } }).structure('main', 't')).rowKey).toEqual([
            'email'
        ]);
    });

    test('pages with offset, limit and hasMore', async () => {
        const { session } = setup();
        const first = await session.rows('main', 'users', { offset: 0, limit: 2 });
        expect(first.rows.map((row) => row[0])).toEqual([1, 2]);
        expect(first.hasMore).toBe(true);
        expect(first.columns[0]).toEqual({ name: 'id', type: 'INTEGER', kind: 'integer' });

        const last = await session.rows('main', 'users', { offset: 2, limit: 2 });
        expect(last.rows.map((row) => row[0])).toEqual([3]);
        expect(last.hasMore).toBe(false);
        expect((await session.rows('main', 'users', { offset: 3, limit: 2 })).rows).toEqual([]);
    });

    test('cuts text and binary at the cell limit', async () => {
        const { session } = setup();
        const result = await session.rows('main', 'users', { offset: 1, limit: 1, cellLimit: 8 });
        expect(result.rows[0]![1]).toEqual({ kind: 'longText', preview: 'bbbbbbbb', length: 52 });
        expect(result.rows[0]![2]).toEqual({ kind: 'binary', hex: '89504e470d0a1a0a', length: 8 });

        const cut = await session.rows('main', 'users', { offset: 1, limit: 1, cellLimit: 4 });
        expect(cut.rows[0]![2]).toEqual({ kind: 'binary', hex: '89504e47', length: 8 });
        expect(cut.rows[0]![0]).toBe(2);
    });

    test('does not interpret where and orderBy', async () => {
        const { session } = setup();
        const result = await session.rows('main', 'users', { offset: 0, limit: 10, where: 'id > 2', orderBy: 'id DESC' });
        expect(result.rows.map((row) => row[0])).toEqual([1, 2, 3]);
        expect(await session.count('main', 'users', 'id > 2')).toBe(3);
    });

    test('reads the whole value of a cell', async () => {
        const { session } = setup();
        expect(await session.cell('main', 'users', { id: 2 }, 'email')).toBe('b'.repeat(40) + '@example.com');
        expect(await session.cell('main', 'users', { id: 2 }, 'avatar')).toEqual({ kind: 'binary', hex: '89504e470d0a1a0a' });
        await expect(session.cell('main', 'users', { id: 99 }, 'email')).rejects.toMatchObject({ code: 'query-failed' });
        await expect(session.cell('main', 'notes', { body: 'one' }, 'body')).rejects.toMatchObject({ code: 'no-row-key' });
        await expect(session.cell('main', 'users', { id: 1 }, 'nope')).rejects.toMatchObject({ sqlState: '42S22' });
    });
});

describe('apply', () => {
    test('inserts with defaults, updates and deletes in one go', async () => {
        const { session } = setup();
        const affected = await session.apply('main', 'users', [
            { kind: 'insert', values: { email: 'new@example.com', created_at: { kind: 'default' } } },
            { kind: 'update', key: { id: 1 }, values: { email: 'changed@example.com', avatar: { kind: 'binary', hex: '00ff' }, role: { kind: 'default' } } },
            { kind: 'delete', key: { id: 3 } }
        ]);
        expect(affected).toBe(3);

        const result = await session.rows('main', 'users', { offset: 0, limit: 10 });
        expect(result.rows.map((row) => row[0])).toEqual([1, 2, 4]);
        expect(result.rows[0]).toEqual([1, 'changed@example.com', { kind: 'binary', hex: '00ff', length: 2 }, '2026-10-01 10:00:00', 'member']);
        expect(result.rows[2]![3]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(result.rows[2]![4]).toBe('member');
        expect(await session.count('main', 'users')).toBe(3);
    });

    test('rolls everything back on a conflict and names the change', async () => {
        const { session } = setup();
        await expect(
            session.apply('main', 'users', [
                { kind: 'delete', key: { id: 1 } },
                { kind: 'update', key: { id: 99 }, values: { email: 'x' } }
            ])
        ).rejects.toMatchObject({ code: 'conflict', change: 1, message: 'The update matched no row.' });
        expect(await session.count('main', 'users')).toBe(3);

        await expect(session.apply('main', 'users', [{ kind: 'delete', key: { role: 'member' } }])).rejects.toMatchObject({
            code: 'conflict',
            change: 0,
            message: 'The delete matched more than one row.'
        });
    });

    test('refuses a read only connection, a view and a table without a row key', async () => {
        const readOnly = setup({ readOnly: true });
        await expect(readOnly.session.apply('main', 'users', [])).rejects.toMatchObject({ code: 'read-only' });

        const { session } = setup();
        await expect(session.apply('main', 'active_users', [])).rejects.toMatchObject({ code: 'unsupported' });
        await expect(session.apply('main', 'notes', [{ kind: 'delete', key: { body: 'one' } }])).rejects.toMatchObject({ code: 'no-row-key' });
        expect(await session.apply('main', 'notes', [{ kind: 'insert', values: { body: 'three' } }])).toBe(1);
    });

    test('rejects a value the column cannot hold', async () => {
        const { session } = setup();
        await expect(session.apply('main', 'users', [{ kind: 'insert', values: { email: null } }])).rejects.toMatchObject({
            code: 'query-failed',
            sqlState: '23000'
        });
        await expect(session.apply('main', 'users', [{ kind: 'insert', values: { id: 1, email: 'dup' } }])).rejects.toMatchObject({
            code: 'query-failed',
            message: expect.stringContaining('Duplicate')
        });
        await expect(session.apply('main', 'users', [{ kind: 'insert', values: { nope: 1, email: 'x' } }])).rejects.toMatchObject({ sqlState: '42S22' });
        await expect(session.apply('main', 'notes', [{ kind: 'insert', values: {} }])).rejects.toMatchObject({
            message: expect.stringContaining('default value')
        });
        expect(await session.count('main', 'users')).toBe(3);
    });

    test('works on a copy of the data it was given', async () => {
        const { session, data } = setup();
        await session.apply('main', 'users', [{ kind: 'delete', key: { id: 1 } }]);
        expect(data.schemas.main!.users!.rows).toHaveLength(3);
    });
});

describe('execute', () => {
    test('answers SELECT * FROM <table> on the first schema, in any case and quoting', async () => {
        const { session } = setup();
        const [result] = await session.execute('select * from `notes`;');
        expect(result).toMatchObject({ kind: 'rows', sql: 'select * from `notes`', hasMore: false });
        expect(result!.kind === 'rows' ? result.rows : []).toEqual([['one'], ['two']]);
    });

    test('honors the schema, the limit and keeps the schema selected', async () => {
        const { session } = setup();
        const [archive] = await session.execute('SELECT * FROM old', { schema: 'archive' });
        expect(archive!.kind).toBe('rows');
        const [again] = await session.execute('SELECT * FROM old');
        expect(again!.kind).toBe('rows');

        const [elsewhere] = await session.execute('SELECT * FROM old', { schema: 'main' });
        expect(elsewhere!.kind).toBe('error');
        const [paged] = await session.execute('SELECT * FROM users', { schema: 'main', limit: 2 });
        expect(paged).toMatchObject({ kind: 'rows', hasMore: true });
        await expect(session.execute('SELECT * FROM users', { schema: 'nope' })).rejects.toMatchObject({ code: 'query-failed' });
    });

    test('answers anything else with an unsupported error and stops the list there', async () => {
        const { session } = setup();
        const results = await session.execute('SELECT * FROM notes; DELETE FROM notes; SELECT * FROM users');
        expect(results.map((result) => result.kind)).toEqual(['rows', 'error']);
        expect(results[1]).toMatchObject({ kind: 'error', sql: 'DELETE FROM notes', error: { code: 'unsupported' } });
        expect((await session.execute('SELECT * FROM missing'))[0]).toMatchObject({ kind: 'error', error: { code: 'query-failed', sqlState: '42S02' } });
    });
});

describe('the session', () => {
    test('close ends the session and the client opens a new one', async () => {
        const { session } = setup();
        await session.schemas();
        await session.close();
        expect(await session.schemas()).toHaveLength(2);
    });

    test('answers unknown-session for a session it does not know', async () => {
        const transport = fakeDatabaseTransport({ databases: {} });
        const response = await transport({ id: 'r1', method: 'schemas', params: { session: 'nope' } });
        expect(response).toMatchObject({ id: 'r1', ok: false, error: { code: 'unknown-session' } });
        expect(await transport({ id: 'r2', method: 'cancel', params: { request: 'r1' } })).toEqual({ id: 'r2', ok: true, result: { cancelled: false } });
    });
});

describe('latency', () => {
    test('delays the answers', async () => {
        const { session } = setup({ latencyMs: 20 });
        const started = performance.now();
        await session.schemas();
        expect(performance.now() - started).toBeGreaterThanOrEqual(35);
    });

    test('cancels a request that is still waiting', async () => {
        const { session } = setup({ latencyMs: 200 });
        await session.server();
        const controller = new AbortController();
        const pending = session.rows('main', 'users', { offset: 0, limit: 1 }, { signal: controller.signal });
        const started = performance.now();
        setTimeout(() => controller.abort(), 10);
        await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
        expect(performance.now() - started).toBeLessThan(150);
    });

    test('answers a cancel with cancelled true for the request it stopped', async () => {
        const transport = fakeDatabaseTransport({ databases: { db: database() }, latencyMs: 100 });
        const opened = await transport({ id: 'r1', method: 'open', params: { connection: { engine: 'mysql', host: 'db', user: 'u' } } });
        const session = (opened as { result: { session: string } }).result.session;
        const waiting = transport({ id: 'r2', method: 'schemas', params: { session } });
        const cancel = await transport({ id: 'r3', method: 'cancel', params: { request: 'r2' } });
        expect(cancel).toEqual({ id: 'r3', ok: true, result: { cancelled: true } });
        expect(await waiting).toMatchObject({ id: 'r2', ok: false, error: { code: 'cancelled' } });
    });
});
