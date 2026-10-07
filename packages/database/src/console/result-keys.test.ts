import { describe, expect, test } from 'bun:test';
import type { ResultColumn, TableStructure } from '../protocol/index.ts';
import { resultKeysOf, sourceTablesOf } from './result-keys.ts';

const from = (table: string, column: string, name = column): ResultColumn => ({
    name,
    type: 'INT',
    kind: 'integer',
    source: { schema: 'shop', table, column }
});
const computed: ResultColumn = { name: 'total', type: '', kind: 'integer' };

const structure = (name: string, primaryKey: string[], foreignKeys: TableStructure['foreignKeys'] = []): TableStructure => ({
    schema: 'shop',
    name,
    kind: 'table',
    columns: [],
    primaryKey,
    rowKey: primaryKey,
    indexes: [],
    foreignKeys,
    ddl: null
});

const structures = new Map([
    [
        'shop\u0000orders',
        structure(
            'orders',
            ['id'],
            [
                {
                    name: 'orders_user',
                    columns: ['user_id'],
                    referencedSchema: 'shop',
                    referencedTable: 'users',
                    referencedColumns: ['id'],
                    onUpdate: null,
                    onDelete: null
                }
            ]
        )
    ],
    ['shop\u0000users', structure('users', ['id'])]
]);

// A join of orders with their users, with an expression, as `SELECT o.id, o.user_id, u.id, u.id AS who, o.total * 2 AS total`.
const columns = [from('orders', 'id'), from('orders', 'user_id'), from('users', 'id'), from('users', 'id', 'who'), computed];

describe('the keys of a result', () => {
    test('name each table the columns come from once', () => {
        expect(sourceTablesOf(columns)).toEqual([
            { schema: 'shop', table: 'orders' },
            { schema: 'shop', table: 'users' }
        ]);
        expect(sourceTablesOf([computed])).toEqual([]);
    });

    test('mark the keys of the table each column comes from, an alias included, and nothing on an expression', () => {
        const keys = resultKeysOf('mysql', columns, structures);
        expect(keys.columns.map((column) => [column.primaryKey, column.foreignKey])).toEqual([
            [true, false],
            [false, true],
            [true, false],
            [true, false],
            [undefined, undefined]
        ]);
        expect(resultKeysOf('mysql', columns, new Map()).columns).toEqual(columns);
    });

    test('point a foreign key at its row from the cells of its own table, never from a column of the same name of another', () => {
        const keys = resultKeysOf('mysql', columns, structures);
        expect(keys.isReference(1)).toBe(true);
        expect(keys.isReference(0)).toBe(false);
        expect(keys.referenceAt(1, [7, 3, 9, 9, 14])).toEqual({ schema: 'shop', table: 'users', where: '`id` = 3' });
        expect(keys.referenceAt(1, [7, null, 9, 9, 14])).toBeNull();
        expect(keys.referenceAt(4, [7, 3, 9, 9, 14])).toBeNull();
    });
});
