import { describe, expect, test } from 'bun:test';
import type { ForeignKeyInfo } from '../protocol/index.ts';
import { foreignKeyOf, referenceOf } from './references.ts';

const single: ForeignKeyInfo = {
    name: 'fk_customer',
    columns: ['customer_id'],
    referencedSchema: 'shop',
    referencedTable: 'customers',
    referencedColumns: ['id'],
    onUpdate: null,
    onDelete: null
};

const pair: ForeignKeyInfo = {
    name: null,
    columns: ['order_id', 'line'],
    referencedSchema: 'shop',
    referencedTable: 'order_lines',
    referencedColumns: ['order_id', 'number'],
    onUpdate: null,
    onDelete: null
};

const columns = [
    { name: 'id', kind: 'integer' as const },
    { name: 'customer_id', kind: 'integer' as const },
    { name: 'order_id', kind: 'integer' as const },
    { name: 'line', kind: 'text' as const }
];

describe('foreignKeyOf', () => {
    test('finds the key a column is part of', () => {
        expect(foreignKeyOf([single, pair], 'line')).toBe(pair);
        expect(foreignKeyOf([single, pair], 'customer_id')).toBe(single);
        expect(foreignKeyOf([single, pair], 'id')).toBeUndefined();
    });
});

describe('referenceOf', () => {
    test('points at the referenced row by the referenced column names', () => {
        expect(referenceOf('mysql', single, columns, [1, 42, null, null])).toEqual({
            schema: 'shop',
            table: 'customers',
            where: '`id` = 42'
        });
    });

    test('ands every column of a multi-column key, matched by position', () => {
        expect(referenceOf('sqlite', pair, columns, [1, null, 7, "A'1"])?.where).toBe(`"order_id" = 7 AND "number" = 'A''1'`);
    });

    test('is null when a column of the key is NULL', () => {
        expect(referenceOf('mysql', single, columns, [1, null, null, null])).toBeNull();
        expect(referenceOf('mysql', pair, columns, [1, null, 7, null])).toBeNull();
    });

    test('is null for a preview or a DEFAULT, which hold no whole value', () => {
        expect(referenceOf('mysql', single, columns, [1, { kind: 'default' }, null, null])).toBeNull();
        expect(referenceOf('mysql', pair, columns, [1, null, 7, { kind: 'longText', preview: 'A', length: 900 }])).toBeNull();
    });

    test('is null when the key names a column the result does not have', () => {
        expect(referenceOf('mysql', single, [{ name: 'id', kind: 'integer' }], [1])).toBeNull();
    });
});
