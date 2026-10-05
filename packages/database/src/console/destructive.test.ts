import { describe, expect, test } from 'bun:test';
import { findDestructive, type DestructiveKind } from './destructive.ts';

const kinds = (sql: string, engine: 'sqlite' | 'mysql' = 'mysql'): DestructiveKind[] => findDestructive(sql, engine).map(({ kind }) => kind);

describe('findDestructive', () => {
    test('flags a drop and a truncate', () => {
        expect(kinds('DROP TABLE users')).toEqual(['drop']);
        expect(kinds('drop database shop; TRUNCATE TABLE logs')).toEqual(['drop', 'truncate']);
        expect(kinds('-- clean up\n/* x */ DROP INDEX idx ON t')).toEqual(['drop']);
    });

    test('flags a delete or an update without a WHERE', () => {
        expect(kinds('DELETE FROM users')).toEqual(['delete']);
        expect(kinds('UPDATE users SET active = 0')).toEqual(['update']);
        expect(kinds('DELETE FROM users ORDER BY id LIMIT 10')).toEqual(['delete']);
    });

    test('leaves a delete or an update with a WHERE alone', () => {
        expect(kinds('DELETE FROM users WHERE id = 1')).toEqual([]);
        expect(kinds('update users set active = 0 where id in (select id from old)')).toEqual([]);
    });

    test('a WHERE inside parentheses does not filter the statement', () => {
        expect(kinds('UPDATE users SET rank = (SELECT MAX(rank) FROM other WHERE id = 1)')).toEqual(['update']);
    });

    test('a WHERE in a string or a comment does not count', () => {
        expect(kinds("UPDATE users SET note = 'where'")).toEqual(['update']);
        expect(kinds('DELETE FROM users -- WHERE id = 1')).toEqual(['delete']);
    });

    test('flags an ALTER that drops something', () => {
        expect(kinds('ALTER TABLE users DROP COLUMN age')).toEqual(['alterDrop']);
        expect(kinds('ALTER TABLE users ADD COLUMN age INT')).toEqual([]);
    });

    test('finds the delete behind a WITH', () => {
        expect(kinds('WITH old AS (SELECT id FROM t WHERE x = 1) DELETE FROM t')).toEqual(['delete']);
        expect(kinds('WITH old AS (SELECT 1) DELETE FROM t WHERE id IN (SELECT * FROM old)')).toEqual([]);
        expect(kinds('WITH a AS (SELECT 1) SELECT * FROM a')).toEqual([]);
    });

    test('leaves reads, inserts and an upsert alone', () => {
        expect(kinds('SELECT * FROM users')).toEqual([]);
        expect(kinds('INSERT INTO t (a) VALUES (1) ON DUPLICATE KEY UPDATE a = 2')).toEqual([]);
    });

    test('keeps the text of each statement', () => {
        expect(findDestructive('SELECT 1; DELETE FROM t;', 'sqlite')).toEqual([{ sql: 'DELETE FROM t', kind: 'delete' }]);
    });

    test('does not flag a DELETE inside the body of a SQLite trigger', () => {
        expect(kinds('CREATE TRIGGER t AFTER INSERT ON a BEGIN DELETE FROM b; END', 'sqlite')).toEqual([]);
    });
});
