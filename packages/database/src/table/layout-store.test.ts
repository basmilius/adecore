import { describe, expect, test } from 'bun:test';
import { EMPTY_LAYOUT, layoutStorageKey, parseStoredLayout, serializeLayout, type StoredLayout } from './layout-store.ts';

const layout: StoredLayout = {
    widths: { id: 90, name: 240 },
    hidden: ['notes'],
    pinned: ['id'],
    pageSize: 1000,
    where: 'id > 5',
    orderBy: '`name` ASC',
    filters: [{ text: 'id > 5', sql: '`id` > 5' }]
};

describe('layoutStorageKey', () => {
    test('names the connection, the schema and the table', () => {
        expect(layoutStorageKey('conn-1', 'shop', 'orders')).toBe('database:table:conn-1:shop.orders');
    });
});

describe('parseStoredLayout', () => {
    test('reads what serializeLayout wrote', () => {
        expect(parseStoredLayout(serializeLayout(layout))).toEqual(layout);
        expect(parseStoredLayout(serializeLayout(EMPTY_LAYOUT))).toEqual(EMPTY_LAYOUT);
    });

    test('ignores a missing, broken or foreign value', () => {
        expect(parseStoredLayout(null)).toBeNull();
        expect(parseStoredLayout('')).toBeNull();
        expect(parseStoredLayout('{not json')).toBeNull();
        expect(parseStoredLayout('[]')).toBeNull();
        expect(parseStoredLayout('"text"')).toBeNull();
        expect(parseStoredLayout('null')).toBeNull();
    });

    test('ignores another version', () => {
        expect(parseStoredLayout(JSON.stringify({ ...layout, version: 0 }))).toBeNull();
        expect(parseStoredLayout(JSON.stringify({ ...layout, version: 2 }))).toBeNull();
        expect(parseStoredLayout(JSON.stringify(layout))).toBeNull();
    });

    test('drops a field of the wrong type and keeps the rest', () => {
        const parsed = parseStoredLayout(
            JSON.stringify({
                version: 1,
                widths: { id: 'wide', name: 120, bad: -5 },
                hidden: 'notes',
                pinned: ['id', 4],
                pageSize: 77,
                where: 3,
                orderBy: 'id'
            })
        );
        expect(parsed).toEqual({ widths: { name: 120 }, hidden: [], pinned: [], pageSize: null, where: '', orderBy: 'id', filters: [] });
    });

    test('reads a value stored before the filter chips as having none', () => {
        const parsed = parseStoredLayout(JSON.stringify({ version: 1, widths: {}, hidden: [], pinned: [], pageSize: 100, where: 'id > 5', orderBy: 'id' }));
        expect(parsed).toEqual({ widths: {}, hidden: [], pinned: [], pageSize: 100, where: 'id > 5', orderBy: 'id', filters: [] });
    });

    test('keeps the filters that are text and sql and drops the rest', () => {
        const parsed = parseStoredLayout(
            JSON.stringify({
                version: 1,
                filters: [{ text: 'a = 1', sql: '"a" = 1' }, { text: 'b' }, { text: 'c', sql: '  ' }, 'd', null, { text: 4, sql: 'x' }]
            })
        );
        expect(parsed?.filters).toEqual([{ text: 'a = 1', sql: '"a" = 1' }]);
    });
});
