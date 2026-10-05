import { describe, expect, test } from 'bun:test';
import { dialectOf } from '../ddl/index.ts';
import { statementOf } from './table-statements.ts';

const mysql = dialectOf({ flavor: 'mysql', version: '8.0.36' });
const sqlite = dialectOf({ flavor: 'sqlite', version: '3.45.1' });
const ref = { connectionId: 'a', schema: 'shop', table: 'orders' };

describe('statementOf', () => {
    test('renames a table in its own schema', () => {
        expect(statementOf(mysql, 'rename', ref, 'table', 'sales')).toBe('RENAME TABLE `shop`.`orders` TO `shop`.`sales`');
        expect(statementOf(sqlite, 'rename', { ...ref, schema: 'main' }, 'table', 'sales')).toBe('ALTER TABLE "orders" RENAME TO "sales"');
    });

    test('truncates a table, which SQLite does by deleting every row', () => {
        expect(statementOf(mysql, 'truncate', ref, 'table')).toBe('TRUNCATE TABLE `shop`.`orders`');
        expect(statementOf(sqlite, 'truncate', { ...ref, schema: 'main' }, 'table')).toBe('DELETE FROM "orders"');
    });

    test('drops a table or a view with the statement of its kind', () => {
        expect(statementOf(mysql, 'drop', ref, 'table')).toBe('DROP TABLE `shop`.`orders`');
        expect(statementOf(mysql, 'drop', ref, 'view')).toBe('DROP VIEW `shop`.`orders`');
    });
});
