import { describe, expect, test } from 'bun:test';
import { addEntry, HISTORY_LIMIT, historyKey, parseHistory, searchHistory, serializeHistory, type HistoryEntry } from './history.ts';

const entry = (sql: string, at = 1, ok = true): HistoryEntry => ({ sql, at, connection: 'Notes', ok, rows: 1 });

describe('addEntry', () => {
    test('puts the newest run first', () => {
        expect(addEntry([entry('SELECT 1')], entry('SELECT 2', 2)).map(({ sql }) => sql)).toEqual(['SELECT 2', 'SELECT 1']);
    });

    test('collapses a repeat of the latest run into the newer one', () => {
        const next = addEntry([entry('SELECT 1', 1), entry('SELECT 0', 0)], entry('SELECT 1 ', 5, false));
        expect(next).toHaveLength(2);
        expect(next[0]).toMatchObject({ at: 5, ok: false });
    });

    test('keeps a repeat of an older run', () => {
        expect(addEntry([entry('SELECT 2'), entry('SELECT 1')], entry('SELECT 1', 9))).toHaveLength(3);
    });

    test('holds at most 200 runs', () => {
        const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => entry(`SELECT ${i}`));
        const next = addEntry(full, entry('SELECT new'));
        expect(next).toHaveLength(HISTORY_LIMIT);
        expect(next[0]!.sql).toBe('SELECT new');
        expect(next.at(-1)!.sql).toBe(`SELECT ${HISTORY_LIMIT - 2}`);
    });

    test('does not change the list it is handed', () => {
        const list = [entry('SELECT 1')];
        addEntry(list, entry('SELECT 2'));
        expect(list).toHaveLength(1);
    });
});

describe('parseHistory', () => {
    test('reads what serializeHistory wrote', () => {
        const entries = [entry('SELECT 1'), { ...entry('SELECT 2'), rows: null }];
        expect(parseHistory(serializeHistory(entries))).toEqual(entries);
    });

    test('gives an empty list for nothing, for broken JSON and for another shape', () => {
        expect(parseHistory(null)).toEqual([]);
        expect(parseHistory('{nope')).toEqual([]);
        expect(parseHistory('{"sql":"x"}')).toEqual([]);
    });

    test('leaves out the entries that do not fit', () => {
        expect(parseHistory(JSON.stringify([entry('SELECT 1'), { sql: 3 }, null]))).toEqual([entry('SELECT 1')]);
    });

    test('keeps at most 200 entries', () => {
        const many = Array.from({ length: 250 }, (_, i) => entry(`SELECT ${i}`));
        expect(parseHistory(serializeHistory(many))).toHaveLength(HISTORY_LIMIT);
    });
});

describe('searchHistory', () => {
    const entries = [entry('SELECT * FROM users'), entry('DELETE FROM orders WHERE id = 3'), entry('select name from users')];

    test('hands back everything for an empty query', () => {
        expect(searchHistory(entries, '  ')).toBe(entries);
    });

    test('matches every word in any case', () => {
        expect(searchHistory(entries, 'FROM USERS').map(({ sql }) => sql)).toEqual(['SELECT * FROM users', 'select name from users']);
        expect(searchHistory(entries, 'orders users')).toEqual([]);
    });
});

describe('historyKey', () => {
    test('is per connection', () => {
        expect(historyKey('one')).toBe('database:console-history:one');
    });
});
