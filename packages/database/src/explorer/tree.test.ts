import { describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import type { SchemaInfo, TableInfo } from '../protocol/index.ts';
import { IDLE, connectionKey, flattenTree, navigate, neededLoads, schemaKey, tabStop, tableKey, type Load, type TreeInput, type TreeRow } from './tree.ts';

const connection = (id: string, engine: 'sqlite' | 'mysql' = 'mysql'): Connection => ({
    id,
    name: id,
    config: engine === 'sqlite' ? { engine, path: '/db' } : { engine, host: 'h', user: 'u' }
});

const schema = (name: string, system = false): SchemaInfo => ({ name, system });
const table = (name: string, kind: 'table' | 'view' = 'table'): TableInfo => ({ name, kind, rowEstimate: null, comment: null });
const ready = <T>(value: T): Load<T> => ({ status: 'ready', value });

interface World {
    connections: Connection[];
    schemas?: Record<string, Load<readonly SchemaInfo[]>>;
    tables?: Record<string, Load<readonly TableInfo[]>>;
    expanded?: string[];
    filter?: string;
    showSystemSchemas?: boolean;
}

const inputOf = (world: World): TreeInput => ({
    connections: world.connections,
    expanded: new Set(world.expanded ?? []),
    filter: world.filter ?? '',
    showSystemSchemas: world.showSystemSchemas ?? false,
    schemas: (id) => world.schemas?.[id] ?? IDLE,
    tables: (id, name) => world.tables?.[`${id}/${name}`] ?? IDLE
});

const labels = (rows: readonly TreeRow[]): string[] =>
    rows.map((row) => {
        const name = row.kind === 'connection' ? row.connection.id : row.kind === 'schema' ? row.schema : row.kind === 'table' ? row.table.name : row.kind;
        return `${row.level}:${name}`;
    });

const app = connection('app');
const world: World = {
    connections: [app],
    schemas: { app: ready([schema('shop'), schema('blog'), schema('mysql', true)]) },
    tables: { 'app/shop': ready([table('orders'), table('users'), table('active_users', 'view')]), 'app/blog': ready([table('posts')]) }
};

describe('flattenTree', () => {
    test('shows a closed connection as one row', () => {
        expect(labels(flattenTree(inputOf({ ...world })))).toEqual(['1:app']);
    });

    test('asks an open connection for its schemas with a loading row', () => {
        const rows = flattenTree(inputOf({ connections: [app], expanded: [connectionKey('app')] }));
        expect(labels(rows)).toEqual(['1:app', '2:loading']);
        expect(rows[1]!.focusable).toBe(false);
    });

    test('shows a failed load as a row that can be retried', () => {
        const rows = flattenTree(inputOf({ connections: [app], expanded: [connectionKey('app')], schemas: { app: { status: 'error', message: 'down' } } }));
        expect(rows[1]).toMatchObject({ kind: 'error', message: 'down', retry: { connectionId: 'app' }, focusable: true });
    });

    test('lists schemas without the system ones, and with them when asked', () => {
        const open = { ...world, expanded: [connectionKey('app')] };
        expect(labels(flattenTree(inputOf(open)))).toEqual(['1:app', '2:shop', '2:blog']);
        expect(labels(flattenTree(inputOf({ ...open, showSystemSchemas: true })))).toEqual(['1:app', '2:shop', '2:blog', '2:mysql']);
    });

    test('puts the tables of an open schema under it, with the count of the schema', () => {
        const rows = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'shop')] }));
        expect(labels(rows)).toEqual(['1:app', '2:shop', '3:orders', '3:users', '3:active_users', '2:blog']);
        expect(rows[1]).toMatchObject({ kind: 'schema', count: 3, expanded: true });
        expect(rows[5]).toMatchObject({ kind: 'schema', count: 1, expanded: false });
    });

    test('numbers the siblings of a parent for a screen reader', () => {
        const rows = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'shop')] }));
        expect(rows.filter((row) => row.level === 3).map((row) => [row.posInSet, row.setSize])).toEqual([
            [1, 3],
            [2, 3],
            [3, 3]
        ]);
        expect(rows.filter((row) => row.level === 2).map((row) => [row.posInSet, row.setSize])).toEqual([
            [1, 2],
            [2, 2]
        ]);
    });

    test('skips the schema level of a connection with one schema', () => {
        const lite = connection('lite', 'sqlite');
        const rows = flattenTree(
            inputOf({
                connections: [lite],
                expanded: [connectionKey('lite')],
                schemas: { lite: ready([schema('main')]) },
                tables: { 'lite/main': ready([table('notes')]) }
            })
        );
        expect(labels(rows)).toEqual(['1:lite', '2:notes']);
        expect(rows[1]).toMatchObject({ kind: 'table', parent: connectionKey('lite'), ref: { schema: 'main', table: 'notes' } });
    });

    test('says so when a schema has no tables and when a connection has no schemas', () => {
        const empty = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'blog')], tables: { 'app/blog': ready([]) } }));
        expect(empty.map((row) => row.kind)).toEqual(['connection', 'schema', 'schema', 'empty']);
        const none = flattenTree(inputOf({ connections: [app], expanded: [connectionKey('app')], schemas: { app: ready([schema('mysql', true)]) } }));
        expect(none[1]).toMatchObject({ kind: 'empty', of: 'schemas' });
    });
});

describe('flattenTree with a filter', () => {
    const open = { ...world, filter: 'USER' };

    test('keeps the loaded tables that match, case-insensitively, under parents that are open', () => {
        const rows = flattenTree(inputOf(open));
        expect(labels(rows)).toEqual(['1:app', '2:shop', '3:users', '3:active_users']);
        expect(rows[0]).toMatchObject({ expanded: true });
        expect(rows[1]).toMatchObject({ expanded: true, count: 2 });
    });

    test('hides connections and schemas without a match, and what has not loaded', () => {
        expect(flattenTree(inputOf({ ...world, filter: 'zzz' }))).toEqual([]);
        expect(flattenTree(inputOf({ connections: [app, connection('other')], filter: 'a' }))).toEqual([]);
        expect(labels(flattenTree(inputOf({ ...world, filter: 'posts' })))).toEqual(['1:app', '2:blog', '3:posts']);
    });

    test('ignores surrounding spaces in the filter', () => {
        expect(labels(flattenTree(inputOf({ ...world, filter: '  posts ' })))).toEqual(['1:app', '2:blog', '3:posts']);
    });
});

describe('neededLoads', () => {
    test('asks for the schemas of an open connection that has none yet', () => {
        expect(neededLoads(inputOf({ connections: [app, connection('b')], expanded: [connectionKey('app')] }))).toEqual([{ connectionId: 'app' }]);
    });

    test('asks for the tables of the open schemas only', () => {
        const input = inputOf({ connections: [app], expanded: [connectionKey('app'), schemaKey('app', 'blog')], schemas: world.schemas });
        expect(neededLoads(input)).toEqual([{ connectionId: 'app', schema: 'blog' }]);
    });

    test('asks for the tables of the only schema as soon as the connection is open', () => {
        const input = inputOf({ connections: [app], expanded: [connectionKey('app')], schemas: { app: ready([schema('main')]) } });
        expect(neededLoads(input)).toEqual([{ connectionId: 'app', schema: 'main' }]);
    });

    test('asks for nothing that is loading, loaded or failed', () => {
        const input = inputOf({
            connections: [app],
            expanded: [connectionKey('app'), schemaKey('app', 'shop'), schemaKey('app', 'blog')],
            schemas: world.schemas,
            tables: { 'app/shop': { status: 'loading' }, 'app/blog': { status: 'error', message: 'x' } }
        });
        expect(neededLoads(input)).toEqual([]);
    });
});

describe('navigate', () => {
    const rows = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'shop')] }));
    const app_ = connectionKey('app');
    const shop = schemaKey('app', 'shop');
    const orders = tableKey({ connectionId: 'app', schema: 'shop', table: 'orders' });
    const blog = schemaKey('app', 'blog');
    const last = tableKey({ connectionId: 'app', schema: 'shop', table: 'active_users' });

    test('moves with the arrows and stops at both ends', () => {
        expect(navigate(rows, app_, 'ArrowDown')).toEqual({ type: 'focus', key: shop });
        expect(navigate(rows, app_, 'ArrowUp')).toEqual({ type: 'focus', key: app_ });
        expect(navigate(rows, blog, 'ArrowDown')).toEqual({ type: 'focus', key: blog });
    });

    test('jumps to the first and the last row', () => {
        expect(navigate(rows, orders, 'Home')).toEqual({ type: 'focus', key: app_ });
        expect(navigate(rows, orders, 'End')).toEqual({ type: 'focus', key: blog });
    });

    test('opens a closed node with the right arrow and enters an open one', () => {
        expect(navigate(rows, blog, 'ArrowRight')).toEqual({ type: 'expand', key: blog });
        expect(navigate(rows, shop, 'ArrowRight')).toEqual({ type: 'focus', key: orders });
        expect(navigate(rows, orders, 'ArrowRight')).toBeNull();
    });

    test('closes an open node with the left arrow and otherwise goes to the parent', () => {
        expect(navigate(rows, shop, 'ArrowLeft')).toEqual({ type: 'collapse', key: shop });
        expect(navigate(rows, last, 'ArrowLeft')).toEqual({ type: 'focus', key: shop });
        expect(navigate(rows, blog, 'ArrowLeft')).toEqual({ type: 'focus', key: app_ });
        expect(navigate(rows, app_, 'ArrowLeft')).toEqual({ type: 'collapse', key: app_ });
    });

    test('activates the row on Enter and Space, and ignores other keys', () => {
        expect(navigate(rows, orders, 'Enter')).toEqual({ type: 'activate', key: orders });
        expect(navigate(rows, orders, ' ')).toEqual({ type: 'activate', key: orders });
        expect(navigate(rows, orders, 'x')).toBeNull();
        expect(navigate([], null, 'ArrowDown')).toBeNull();
    });

    test('skips a loading row', () => {
        const loading = flattenTree(inputOf({ connections: [app], expanded: [connectionKey('app')] }));
        expect(navigate(loading, connectionKey('app'), 'ArrowDown')).toEqual({ type: 'focus', key: connectionKey('app') });
        expect(navigate(loading, connectionKey('app'), 'End')).toEqual({ type: 'focus', key: connectionKey('app') });
    });

    test('starts at the first row when nothing has the focus', () => {
        expect(navigate(rows, null, 'ArrowDown')).toEqual({ type: 'focus', key: app_ });
    });
});

describe('tabStop', () => {
    const rows = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'shop')] }));
    const orders = tableKey({ connectionId: 'app', schema: 'shop', table: 'orders' });

    test('prefers the row with the focus, then the selection, then the first row', () => {
        expect(tabStop(rows, schemaKey('app', 'blog'), orders)).toBe(schemaKey('app', 'blog'));
        expect(tabStop(rows, 'gone', orders)).toBe(orders);
        expect(tabStop(rows, null, null)).toBe(connectionKey('app'));
        expect(tabStop([], null, null)).toBeNull();
    });
});
