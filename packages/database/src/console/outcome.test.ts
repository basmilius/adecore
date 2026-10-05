import { describe, expect, test } from 'bun:test';
import type { StatementResult } from '../protocol/index.ts';
import { isPageable, outcomeOf } from './outcome.ts';

const rows: StatementResult = { kind: 'rows', sql: 'SELECT 1', columns: [], rows: [[1], [2]], hasMore: false, elapsedMs: 1 };
const done: StatementResult = { kind: 'done', sql: 'UPDATE t SET a = 1', affected: 3, lastInsertId: null, elapsedMs: 1 };
const failed: StatementResult = { kind: 'error', sql: 'SELEC', error: { code: 'query-failed', message: 'syntax error' }, elapsedMs: 1 };

describe('outcomeOf', () => {
    test('sums the rows read and the rows changed', () => {
        expect(outcomeOf([rows, done])).toEqual({ ok: true, rows: 5 });
    });

    test('is not ok when a statement failed', () => {
        expect(outcomeOf([done, failed])).toEqual({ ok: false, rows: 3 });
    });
});

describe('isPageable', () => {
    test('is true for SELECT and WITH, past comments', () => {
        expect(isPageable('select 1', 'sqlite')).toBe(true);
        expect(isPageable('-- all\nWITH a AS (SELECT 1) SELECT * FROM a', 'mysql')).toBe(true);
    });

    test('is false for anything else', () => {
        expect(isPageable('SHOW TABLES', 'mysql')).toBe(false);
        expect(isPageable('PRAGMA table_info(t)', 'sqlite')).toBe(false);
        expect(isPageable('INSERT INTO t VALUES (1)', 'sqlite')).toBe(false);
    });
});
