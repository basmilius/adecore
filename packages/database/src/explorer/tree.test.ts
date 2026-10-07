import { describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import type { ColumnInfo, SchemaInfo, TableInfo, TableStructure } from '../protocol/index.ts';
import {
    IDLE,
    columnKey,
    connectionKey,
    flattenTree,
    folderKey,
    hasMenu,
    isSelectable,
    navigate,
    neededLoads,
    openedTableOf,
    partKey,
    schemaKey,
    selectAllSql,
    selectionKey,
    selectionOf,
    startsOpen,
    tabStop,
    tableKey,
    tableKindIn,
    tableOf,
    type Load,
    type TablePart,
    type TreeInput,
    type TreeRow
} from './tree.ts';

const connection = (id: string, engine: 'sqlite' | 'mysql' = 'mysql'): Connection => ({
    id,
    name: id,
    config: engine === 'sqlite' ? { engine, path: '/db' } : { engine, host: 'h', user: 'u' }
});

const schema = (name: string, system = false): SchemaInfo => ({ name, system });
const table = (name: string, kind: 'table' | 'view' = 'table'): TableInfo => ({ name, kind, rowEstimate: null, comment: null });
const column = (name: string, type = 'int'): ColumnInfo => ({
    name,
    type,
    kind: 'integer',
    nullable: false,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null
});
const structure = (name: string, columns: ColumnInfo[], primaryKey: string[] = [], foreignKeyColumns: string[] = []): TableStructure => ({
    schema: 'shop',
    name,
    kind: 'table',
    columns,
    primaryKey,
    rowKey: primaryKey.length > 0 ? primaryKey : null,
    indexes: [],
    foreignKeys:
        foreignKeyColumns.length === 0
            ? []
            : [
                  {
                      name: null,
                      columns: foreignKeyColumns,
                      referencedSchema: 'shop',
                      referencedTable: 'users',
                      referencedColumns: ['id'],
                      onUpdate: null,
                      onDelete: null
                  }
              ],
    ddl: null
});
const ready = <T>(value: T): Load<T> => ({ status: 'ready', value });

interface World {
    connections: Connection[];
    schemas?: Record<string, Load<readonly SchemaInfo[]>>;
    tables?: Record<string, Load<readonly TableInfo[]>>;
    structures?: Record<string, Load<TableStructure>>;
    versions?: Record<string, string>;
    expanded?: string[];
    collapsed?: string[];
    filter?: string;
    showSystemSchemas?: boolean;
}

const inputOf = (world: World): TreeInput => ({
    connections: world.connections,
    expanded: new Set(world.expanded ?? []),
    collapsed: new Set(world.collapsed ?? []),
    filter: world.filter ?? '',
    showSystemSchemas: world.showSystemSchemas ?? false,
    schemas: (id) => world.schemas?.[id] ?? IDLE,
    tables: (id, name) => world.tables?.[`${id}/${name}`] ?? IDLE,
    structures: (id, name, table) => world.structures?.[`${id}/${name}/${table}`] ?? IDLE,
    versions: (id) => world.versions?.[id] ?? null
});

const nameOf = (row: TreeRow): string => {
    switch (row.kind) {
        case 'connection':
            return row.connection.id;
        case 'schema':
            return row.schema;
        case 'folder':
            return `[${row.group}s]`;
        case 'table':
            return row.table.name;
        case 'column':
            return row.column.name;
        case 'part':
            return `[${row.part}]`;
        case 'entry':
            return `${row.entry.type}`;
        default:
            return row.kind;
    }
};

const labels = (rows: readonly TreeRow[]): string[] =>
    rows.map((row) => {
        const name = nameOf(row);
        return `${row.level}:${name}`;
    });

const app = connection('app');
const world: World = {
    connections: [app],
    schemas: { app: ready([schema('shop'), schema('blog'), schema('mysql', true)]) },
    tables: { 'app/shop': ready([table('orders'), table('users'), table('active_users', 'view')]), 'app/blog': ready([table('posts')]) }
};

const shopTables = tableKey({ connectionId: 'app', schema: 'shop', table: 'orders' });
const usersKey = tableKey({ connectionId: 'app', schema: 'shop', table: 'users' });
const openShop = [connectionKey('app'), schemaKey('app', 'shop')];

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

    test('puts the tables and the views of an open schema in a folder each, with their count', () => {
        const rows = flattenTree(inputOf({ ...world, expanded: openShop }));
        expect(labels(rows)).toEqual(['1:app', '2:shop', '3:[tables]', '4:orders', '4:users', '3:[views]', '4:active_users', '2:blog']);
        expect(rows[2]).toMatchObject({ kind: 'folder', group: 'table', count: 2, expanded: true, parent: schemaKey('app', 'shop') });
        expect(rows[5]).toMatchObject({ kind: 'folder', group: 'view', count: 1, expanded: true });
        expect(rows[3]).toMatchObject({ kind: 'table', parent: folderKey('app', 'shop', 'table'), expanded: false });
    });

    test('leaves out a folder without items', () => {
        const rows = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'blog')] }));
        expect(labels(rows)).toEqual(['1:app', '2:shop', '2:blog', '3:[tables]', '4:posts']);
    });

    test('hides the tables of a folder the person closed', () => {
        const rows = flattenTree(inputOf({ ...world, expanded: openShop, collapsed: [folderKey('app', 'shop', 'table')] }));
        expect(labels(rows)).toEqual(['1:app', '2:shop', '3:[tables]', '3:[views]', '4:active_users', '2:blog']);
        expect(rows[2]).toMatchObject({ expanded: false, count: 2 });
    });

    test('numbers the siblings of a parent for a screen reader', () => {
        const rows = flattenTree(inputOf({ ...world, expanded: openShop }));
        expect(rows.filter((row) => row.level === 4).map((row) => [row.posInSet, row.setSize])).toEqual([
            [1, 2],
            [2, 2],
            [1, 1]
        ]);
        expect(rows.filter((row) => row.level === 3).map((row) => [row.posInSet, row.setSize])).toEqual([
            [1, 2],
            [2, 2]
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
        expect(labels(rows)).toEqual(['1:lite', '2:[tables]', '3:notes']);
        expect(rows[1]).toMatchObject({ kind: 'folder', parent: connectionKey('lite') });
        expect(rows[2]).toMatchObject({ kind: 'table', ref: { schema: 'main', table: 'notes' } });
    });

    test('says so when a schema has no tables and when a connection has no schemas', () => {
        const empty = flattenTree(inputOf({ ...world, expanded: [connectionKey('app'), schemaKey('app', 'blog')], tables: { 'app/blog': ready([]) } }));
        expect(empty.map((row) => row.kind)).toEqual(['connection', 'schema', 'schema', 'empty']);
        const none = flattenTree(inputOf({ connections: [app], expanded: [connectionKey('app')], schemas: { app: ready([schema('mysql', true)]) } }));
        expect(none[1]).toMatchObject({ kind: 'empty', of: 'schemas' });
    });

    test('shows the loading and the failure of the tables of a schema', () => {
        const loading = flattenTree(inputOf({ ...world, expanded: openShop, tables: {} }));
        expect(labels(loading)).toEqual(['1:app', '2:shop', '3:loading', '2:blog']);
        const failed = flattenTree(inputOf({ ...world, expanded: openShop, tables: { 'app/shop': { status: 'error', message: 'denied' } } }));
        expect(failed[2]).toMatchObject({ kind: 'error', retry: { connectionId: 'app', schema: 'shop' }, focusable: true });
    });
});

describe('the connection row', () => {
    test('has no version before the server reported one, and the version after', () => {
        expect(flattenTree(inputOf(world))[0]).toMatchObject({ kind: 'connection', version: null });
        expect(flattenTree(inputOf({ ...world, versions: { app: '11.4.2-MariaDB' } }))[0]).toMatchObject({ version: '11.4.2-MariaDB' });
    });

    test('counts the schemas shown against all of them while the system ones are hidden', () => {
        expect(flattenTree(inputOf(world))[0]).toMatchObject({ schemaCount: { shown: 2, total: 3 } });
        expect(flattenTree(inputOf({ ...world, showSystemSchemas: true }))[0]).toMatchObject({ schemaCount: null });
        expect(flattenTree(inputOf({ connections: [app] }))[0]).toMatchObject({ schemaCount: null });
    });

    test('counts the schemas for a connection with one visible schema as well', () => {
        const rows = flattenTree(inputOf({ connections: [app], schemas: { app: ready([schema('shop'), schema('sys', true)]) } }));
        expect(rows[0]).toMatchObject({ schemaCount: { shown: 1, total: 2 } });
    });
});

describe('the columns of a table', () => {
    const open = { ...world, expanded: [...openShop, usersKey] };

    test('show a loading row until the structure arrives, and a failed load can be retried', () => {
        expect(labels(flattenTree(inputOf(open))).slice(3, 7)).toEqual(['4:orders', '4:users', '5:loading', '3:[views]']);
        const failed = flattenTree(inputOf({ ...open, structures: { 'app/shop/users': { status: 'error', message: 'gone' } } }));
        expect(failed.find((row) => row.kind === 'error')).toMatchObject({
            retry: { connectionId: 'app', schema: 'shop', table: 'users' },
            focusable: true,
            level: 5
        });
    });

    test('list the columns under their table, with their key flags', () => {
        const rows = flattenTree(
            inputOf({
                ...open,
                structures: {
                    'app/shop/users': ready(structure('users', [column('id'), column('team_id'), column('name', 'varchar(255)')], ['id'], ['team_id']))
                }
            })
        );
        expect(labels(rows).slice(4, 12)).toEqual(['4:users', '5:[columns]', '6:id', '6:team_id', '6:name', '5:[keys]', '5:[foreignKeys]', '3:[views]']);
        const columns = rows.filter((row) => row.kind === 'column');
        expect(columns.map((row) => [row.primaryKey, row.foreignKey])).toEqual([
            [true, false],
            [false, true],
            [false, false]
        ]);
        expect(columns[0]).toMatchObject({
            key: columnKey({ connectionId: 'app', schema: 'shop', table: 'users' }, 'id'),
            parent: partKey({ connectionId: 'app', schema: 'shop', table: 'users' }, 'columns'),
            ref: { table: 'users' },
            posInSet: 1,
            setSize: 3
        });
        expect(rows.find((row) => row.key === usersKey)).toMatchObject({ expanded: true });
    });

    test('say so when a table has none', () => {
        const rows = flattenTree(inputOf({ ...open, structures: { 'app/shop/users': ready(structure('users', [])) } }));
        expect(rows.find((row) => row.kind === 'empty')).toMatchObject({ of: 'columns', level: 5 });
    });

    test('stay in the tree whether the filter is on or not', () => {
        const structures = { 'app/shop/users': ready(structure('users', [column('id')])) };
        expect(labels(flattenTree(inputOf({ ...open, structures, filter: 'users' })))).toEqual([
            '1:app',
            '2:shop',
            '3:[tables]',
            '4:users',
            '5:[columns]',
            '6:id',
            '3:[views]',
            '4:active_users'
        ]);
    });
});

describe('the folders of a table', () => {
    const users = { connectionId: 'app', schema: 'shop', table: 'users' };
    const full: TableStructure = {
        ...structure('users', [column('id'), column('team_id'), column('email')], ['id'], ['team_id']),
        indexes: [
            { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
            { name: 'users_email', columns: ['email'], unique: true, primary: false },
            { name: 'users_team', columns: ['team_id'], unique: false, primary: false }
        ],
        checks: [{ name: 'users_email_set', expression: "email <> ''" }],
        triggers: [{ name: 'users_audit', timing: 'AFTER', event: 'UPDATE' }]
    };
    const opened = (expanded: string[] = [], collapsed: string[] = [], value: TableStructure = full) =>
        flattenTree(inputOf({ ...world, expanded: [...openShop, usersKey, ...expanded], collapsed, structures: { 'app/shop/users': ready(value) } }));

    test('come in a fixed order with their counts, the columns open and the rest closed', () => {
        const rows = opened();
        expect(labels(rows).slice(4, 14)).toEqual([
            '4:users',
            '5:[columns]',
            '6:id',
            '6:team_id',
            '6:email',
            '5:[keys]',
            '5:[foreignKeys]',
            '5:[indexes]',
            '5:[checks]',
            '5:[triggers]'
        ]);
        expect(rows.filter((row) => row.kind === 'part').map((row) => (row.kind === 'part' ? [row.part, row.count, row.expanded] : null))).toEqual([
            ['columns', 3, true],
            ['keys', 2, false],
            ['foreignKeys', 1, false],
            ['indexes', 2, false],
            ['checks', 1, false],
            ['triggers', 1, false]
        ]);
    });

    test('show only the folders that hold something, and a view only its columns', () => {
        expect(labels(opened([], [], structure('users', [column('id')]))).slice(4, 7)).toEqual(['4:users', '5:[columns]', '6:id']);
        const view = flattenTree(
            inputOf({
                ...world,
                expanded: [...openShop, tableKey({ connectionId: 'app', schema: 'shop', table: 'active_users' })],
                structures: { 'app/shop/active_users': ready({ ...structure('active_users', [column('id')]), kind: 'view' }) }
            })
        );
        expect(labels(view).slice(-3, -1)).toEqual(['4:active_users', '5:id']);
    });

    test('hold the keys, foreign keys, indexes, checks and triggers of the structure', () => {
        const rows = opened(
            ['keys', 'foreignKeys', 'indexes', 'checks', 'triggers'].map((part) => partKey(users, part as TablePart)),
            [partKey(users, 'columns')]
        );
        const entries = rows.flatMap((row) => (row.kind === 'entry' ? [row.entry] : []));
        expect(entries).toEqual([
            { type: 'key', name: 'PRIMARY', columns: ['id'], primary: true },
            { type: 'key', name: 'users_email', columns: ['email'], primary: false },
            { type: 'foreignKey', foreignKey: full.foreignKeys[0] },
            { type: 'index', index: full.indexes[1] },
            { type: 'index', index: full.indexes[2] },
            { type: 'check', check: full.checks![0] },
            { type: 'trigger', trigger: full.triggers![0] }
        ]);
        expect(labels(rows).slice(4, 6)).toEqual(['4:users', '5:[columns]']);
    });

    test('open a foreign key onto the table it references', () => {
        const rows = opened([partKey(users, 'foreignKeys')]);
        const foreign = rows.find((row) => row.kind === 'entry')!;
        expect(openedTableOf(foreign)).toEqual({ connectionId: 'app', schema: 'shop', table: 'users' });
        expect(tableOf(foreign)).toEqual(users);
    });

    test('say whether a name is a table or a view once the list of the schema has loaded', () => {
        const list: Load<readonly TableInfo[]> = {
            status: 'ready',
            value: [
                { name: 'users', kind: 'table', rowEstimate: null, comment: null },
                { name: 'totals', kind: 'view', rowEstimate: null, comment: null }
            ]
        };
        expect([tableKindIn(list, 'users'), tableKindIn(list, 'totals'), tableKindIn(list, 'gone')]).toEqual(['table', 'view', undefined]);
        expect(tableKindIn({ status: 'loading' }, 'users')).toBeUndefined();
    });

    test('keep a table folder open or closed through the stored expansion', () => {
        expect(startsOpen(partKey(users, 'columns'))).toBe(true);
        expect(startsOpen(partKey(users, 'keys'))).toBe(false);
        expect(startsOpen(folderKey('app', 'shop', 'table'))).toBe(true);
        expect(startsOpen(usersKey)).toBe(false);
    });
});

describe('flattenTree with a filter', () => {
    const open = { ...world, filter: 'USER' };

    test('keeps the loaded tables that match, case-insensitively, under parents that are open', () => {
        const rows = flattenTree(inputOf(open));
        expect(labels(rows)).toEqual(['1:app', '2:shop', '3:[tables]', '4:users', '3:[views]', '4:active_users']);
        expect(rows[0]).toMatchObject({ expanded: true });
        expect(rows[1]).toMatchObject({ expanded: true });
        expect(rows[2]).toMatchObject({ expanded: true, count: 1 });
    });

    test('opens a folder the person closed', () => {
        const rows = flattenTree(inputOf({ ...open, collapsed: [folderKey('app', 'shop', 'view')] }));
        expect(rows.filter((row) => row.kind === 'table')).toHaveLength(2);
    });

    test('hides connections, schemas and folders without a match, and what has not loaded', () => {
        expect(flattenTree(inputOf({ ...world, filter: 'zzz' }))).toEqual([]);
        expect(flattenTree(inputOf({ connections: [app, connection('other')], filter: 'a' }))).toEqual([]);
        expect(labels(flattenTree(inputOf({ ...world, filter: 'posts' })))).toEqual(['1:app', '2:blog', '3:[tables]', '4:posts']);
    });

    test('ignores surrounding spaces in the filter', () => {
        expect(labels(flattenTree(inputOf({ ...world, filter: '  posts ' })))).toEqual(['1:app', '2:blog', '3:[tables]', '4:posts']);
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

    test('asks for the structure of an open table that has none yet', () => {
        const input = inputOf({ ...world, expanded: [...openShop, usersKey, shopTables] });
        expect(neededLoads(input)).toEqual([
            { connectionId: 'app', schema: 'shop', table: 'orders' },
            { connectionId: 'app', schema: 'shop', table: 'users' }
        ]);
    });

    test('asks for nothing that is loading, loaded or failed', () => {
        const input = inputOf({
            connections: [app],
            expanded: [connectionKey('app'), schemaKey('app', 'shop'), schemaKey('app', 'blog'), usersKey],
            schemas: world.schemas,
            tables: { 'app/shop': { status: 'loading' }, 'app/blog': { status: 'error', message: 'x' } }
        });
        expect(neededLoads(input)).toEqual([]);
        const loaded = inputOf({ ...world, expanded: [...openShop, usersKey], structures: { 'app/shop/users': { status: 'loading' } } });
        expect(neededLoads(loaded)).toEqual([]);
    });
});

describe('navigate', () => {
    const structures = { 'app/shop/users': ready(structure('users', [column('id'), column('name')])) };
    const rows = flattenTree(inputOf({ ...world, expanded: [...openShop, usersKey], structures }));
    const app_ = connectionKey('app');
    const shop = schemaKey('app', 'shop');
    const tablesFolder = folderKey('app', 'shop', 'table');
    const orders = shopTables;
    const blog = schemaKey('app', 'blog');
    const firstColumn = columnKey({ connectionId: 'app', schema: 'shop', table: 'users' }, 'id');
    const lastColumn = columnKey({ connectionId: 'app', schema: 'shop', table: 'users' }, 'name');
    const view = tableKey({ connectionId: 'app', schema: 'shop', table: 'active_users' });
    const columnsFolder = partKey({ connectionId: 'app', schema: 'shop', table: 'users' }, 'columns');

    test('moves with the arrows and stops at both ends', () => {
        expect(navigate(rows, app_, 'ArrowDown')).toEqual({ type: 'focus', key: shop });
        expect(navigate(rows, app_, 'ArrowUp')).toEqual({ type: 'focus', key: app_ });
        expect(navigate(rows, blog, 'ArrowDown')).toEqual({ type: 'focus', key: blog });
        expect(navigate(rows, usersKey, 'ArrowDown')).toEqual({ type: 'focus', key: columnsFolder });
        expect(navigate(rows, columnsFolder, 'ArrowDown')).toEqual({ type: 'focus', key: firstColumn });
    });

    test('jumps to the first and the last row', () => {
        expect(navigate(rows, orders, 'Home')).toEqual({ type: 'focus', key: app_ });
        expect(navigate(rows, orders, 'End')).toEqual({ type: 'focus', key: blog });
    });

    test('opens a closed node with the right arrow and enters an open one', () => {
        expect(navigate(rows, blog, 'ArrowRight')).toEqual({ type: 'expand', key: blog });
        expect(navigate(rows, orders, 'ArrowRight')).toEqual({ type: 'expand', key: orders });
        expect(navigate(rows, tablesFolder, 'ArrowRight')).toEqual({ type: 'focus', key: orders });
        expect(navigate(rows, usersKey, 'ArrowRight')).toEqual({ type: 'focus', key: columnsFolder });
        expect(navigate(rows, columnsFolder, 'ArrowRight')).toEqual({ type: 'focus', key: firstColumn });
        expect(navigate(rows, firstColumn, 'ArrowRight')).toBeNull();
    });

    test('closes an open node with the left arrow and otherwise goes to the parent', () => {
        expect(navigate(rows, shop, 'ArrowLeft')).toEqual({ type: 'collapse', key: shop });
        expect(navigate(rows, usersKey, 'ArrowLeft')).toEqual({ type: 'collapse', key: usersKey });
        expect(navigate(rows, lastColumn, 'ArrowLeft')).toEqual({ type: 'focus', key: columnsFolder });
        expect(navigate(rows, columnsFolder, 'ArrowLeft')).toEqual({ type: 'collapse', key: columnsFolder });
        expect(navigate(rows, orders, 'ArrowLeft')).toEqual({ type: 'focus', key: tablesFolder });
        expect(navigate(rows, view, 'ArrowLeft')).toEqual({ type: 'focus', key: folderKey('app', 'shop', 'view') });
        expect(navigate(rows, blog, 'ArrowLeft')).toEqual({ type: 'focus', key: app_ });
    });

    test('activates the row on Enter and Space, a column included, and ignores other keys', () => {
        expect(navigate(rows, orders, 'Enter')).toEqual({ type: 'activate', key: orders });
        expect(navigate(rows, firstColumn, ' ')).toEqual({ type: 'activate', key: firstColumn });
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
    const rows = flattenTree(inputOf({ ...world, expanded: openShop }));

    test('prefers the row with the focus, then the selection, then the first row', () => {
        expect(tabStop(rows, schemaKey('app', 'blog'), shopTables)).toBe(schemaKey('app', 'blog'));
        expect(tabStop(rows, 'gone', shopTables)).toBe(shopTables);
        expect(tabStop(rows, null, null)).toBe(connectionKey('app'));
        expect(tabStop([], null, null)).toBeNull();
    });
});

describe('selecting a row', () => {
    const rows = flattenTree(
        inputOf({
            ...world,
            expanded: [...openShop, usersKey],
            structures: { 'app/shop/users': ready(structure('users', [column('id')], ['id'])) }
        })
    );
    const rowOf = (kind: TreeRow['kind']): TreeRow => rows.find((row) => row.kind === kind)!;

    test('gives a connection its id, a schema or a folder its schema, a table or a column its table', () => {
        expect(selectionOf(rowOf('connection'))).toEqual({ connectionId: 'app' });
        expect(selectionOf(rowOf('schema'))).toEqual({ connectionId: 'app', schema: 'shop' });
        expect(selectionOf(rowOf('folder'))).toEqual({ connectionId: 'app', schema: 'shop' });
        expect(selectionOf(rowOf('table'))).toEqual({ connectionId: 'app', schema: 'shop', table: 'orders' });
        expect(selectionOf(rowOf('column'))).toEqual({ connectionId: 'app', schema: 'shop', table: 'users' });
    });

    test('selects nothing on a row that only reports', () => {
        const loading = flattenTree(inputOf({ ...world, expanded: [connectionKey('app')], schemas: { app: { status: 'loading' } } }));
        expect(selectionOf(loading.find((row) => row.kind === 'loading')!)).toBeNull();
    });

    test('has a menu on every row that stands for something, and none on a status row', () => {
        expect(new Set(rows.filter(hasMenu).map((row) => row.kind))).toEqual(new Set(['connection', 'schema', 'folder', 'table', 'column']));
        const loading = flattenTree(inputOf({ ...world, expanded: [connectionKey('app')], schemas: { app: { status: 'loading' } } }));
        expect(loading.filter(hasMenu).map((row) => row.kind)).toEqual(['connection']);
    });

    test('points a selection at the row of its table, else its schema, else its connection', () => {
        expect(selectionKey({ connectionId: 'app', schema: 'shop', table: 'users' })).toBe(usersKey);
        expect(selectionKey({ connectionId: 'app', schema: 'shop' })).toBe(schemaKey('app', 'shop'));
        expect(selectionKey({ connectionId: 'app' })).toBe(connectionKey('app'));
    });

    test('draws a connection, a schema and a table selected, and no other row', () => {
        expect(new Set(rows.filter(isSelectable).map((row) => row.kind))).toEqual(new Set(['connection', 'schema', 'table']));
        expect(new Set(rows.filter((row) => !isSelectable(row)).map((row) => row.kind))).toEqual(new Set(['folder', 'part', 'column']));
    });
});

describe('selectAllSql', () => {
    const ref = { connectionId: 'app', schema: 'shop', table: 'order items' };

    test('quotes the schema and the table the way the engine does', () => {
        expect(selectAllSql('mysql', ref)).toBe('SELECT * FROM `shop`.`order items`');
        expect(selectAllSql('sqlite', ref)).toBe('SELECT * FROM "shop"."order items"');
    });
});
