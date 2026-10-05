import { describe, expect, test } from 'bun:test';
import { firstKeyword, splitStatements, statementAt, tokenize } from './sql-split.ts';

const sqlite = (sql: string): string[] => splitStatements(sql, 'sqlite').map((statement) => statement.text);
const mysql = (sql: string): string[] => splitStatements(sql, 'mysql').map((statement) => statement.text);

describe('splitStatements', () => {
    test('splits on semicolons and skips empty statements', () => {
        expect(sqlite('SELECT 1; ;; SELECT 2;\n')).toEqual(['SELECT 1', 'SELECT 2']);
        expect(sqlite('   ')).toEqual([]);
        expect(sqlite('SELECT 1')).toEqual(['SELECT 1']);
    });

    test('reports the offsets of the trimmed statement', () => {
        const sql = '  SELECT 1 ;\n\n  SELECT 2';
        const [first, second] = splitStatements(sql, 'sqlite');
        expect(sql.slice(first!.start, first!.end)).toBe('SELECT 1');
        expect(sql.slice(second!.start, second!.end)).toBe('SELECT 2');
        expect(second!.end).toBe(sql.length);
    });

    test('keeps semicolons inside strings and names', () => {
        expect(sqlite('SELECT \'a;b\'; SELECT "c;d", [e;f], `g;h`')).toEqual(["SELECT 'a;b'", 'SELECT "c;d", [e;f], `g;h`']);
        expect(sqlite("SELECT 'it''s;'; SELECT 2")).toEqual(["SELECT 'it''s;'", 'SELECT 2']);
        expect(mysql("SELECT 'a;b'; SELECT `c;d`")).toEqual(["SELECT 'a;b'", 'SELECT `c;d`']);
    });

    test('brackets only quote in SQLite', () => {
        expect(mysql('SELECT [1; SELECT 2')).toEqual(['SELECT [1', 'SELECT 2']);
    });

    test('MySQL strings use backslash escapes, SQLite strings do not', () => {
        expect(mysql("SELECT 'a\\';b'; SELECT 2")).toEqual(["SELECT 'a\\';b'", 'SELECT 2']);
        expect(mysql('SELECT "a\\";b"; SELECT 2')).toEqual(['SELECT "a\\";b"', 'SELECT 2']);
        expect(sqlite("SELECT 'a\\'; SELECT 2")).toEqual(["SELECT 'a\\'", 'SELECT 2']);
    });

    test('skips comments', () => {
        expect(sqlite('SELECT 1 -- a;b\n; SELECT 2 /* c;d */;')).toEqual(['SELECT 1 -- a;b', 'SELECT 2 /* c;d */']);
        expect(mysql('SELECT 1 # a;b\n; SELECT 2')).toEqual(['SELECT 1 # a;b', 'SELECT 2']);
        expect(sqlite('-- only a comment')).toEqual([]);
        expect(sqlite('SELECT 1; /* trailing */ -- more')).toEqual(['SELECT 1']);
    });

    test('a hash only comments in MySQL', () => {
        expect(sqlite('SELECT 1 # a;b\n; SELECT 2')).toEqual(['SELECT 1 # a', 'b', 'SELECT 2']);
    });

    test('MySQL dashes need whitespace to comment', () => {
        expect(mysql('SELECT 1--1; SELECT 2')).toEqual(['SELECT 1--1', 'SELECT 2']);
        expect(mysql('SELECT 1 -- x;y\n; SELECT 2')).toEqual(['SELECT 1 -- x;y', 'SELECT 2']);
        expect(sqlite('SELECT 1--x;y\n; SELECT 2')).toEqual(['SELECT 1--x;y', 'SELECT 2']);
    });

    test('an unterminated quote or comment runs to the end', () => {
        expect(sqlite("SELECT 'abc; SELECT 2")).toEqual(["SELECT 'abc; SELECT 2"]);
        expect(sqlite('SELECT 1 /* open; SELECT 2')).toEqual(['SELECT 1 /* open; SELECT 2']);
    });

    test('keeps SQLite trigger bodies whole', () => {
        const sql = 'CREATE TRIGGER t AFTER INSERT ON a BEGIN INSERT INTO b VALUES (CASE WHEN 1 THEN 2 END); UPDATE c SET x = 1; END; SELECT 1';
        expect(sqlite(sql)).toEqual([
            'CREATE TRIGGER t AFTER INSERT ON a BEGIN INSERT INTO b VALUES (CASE WHEN 1 THEN 2 END); UPDATE c SET x = 1; END',
            'SELECT 1'
        ]);
        expect(sqlite('CREATE TEMP TRIGGER t AFTER INSERT ON a BEGIN SELECT 1; END;')).toHaveLength(1);
    });

    test('BEGIN outside a trigger is an ordinary statement', () => {
        expect(sqlite('BEGIN; INSERT INTO a VALUES (1); END;')).toEqual(['BEGIN', 'INSERT INTO a VALUES (1)', 'END']);
    });

    test('counts characters beyond ASCII as part of a word', () => {
        expect(sqlite("SELECT naïve FROM t; SELECT 'é;'")).toEqual(['SELECT naïve FROM t', "SELECT 'é;'"]);
    });
});

describe('statementAt', () => {
    const script = 'SELECT 1;\n\nSELECT 2;   SELECT 3';

    test('picks the statement the caret is inside', () => {
        expect(statementAt(script, 3, 'sqlite')?.text).toBe('SELECT 1');
        expect(statementAt(script, 13, 'sqlite')?.text).toBe('SELECT 2');
        expect(statementAt(script, script.length, 'sqlite')?.text).toBe('SELECT 3');
    });

    test('a caret right after the semicolon, or later on its line, still belongs to that statement', () => {
        expect(statementAt(script, 9, 'sqlite')?.text).toBe('SELECT 1');
        expect(statementAt(script, 22, 'sqlite')?.text).toBe('SELECT 2');
    });

    test('a caret on a line of its own belongs to the next statement', () => {
        expect(statementAt(script, 10, 'sqlite')?.text).toBe('SELECT 2');
        expect(statementAt(script, 11, 'sqlite')?.text).toBe('SELECT 2');
    });

    test('a caret before the first statement belongs to it', () => {
        expect(statementAt('\n\nSELECT 1; SELECT 2', 0, 'sqlite')?.text).toBe('SELECT 1');
    });

    test('a caret after the last statement belongs to it', () => {
        expect(statementAt('SELECT 1;\n\n', 11, 'sqlite')?.text).toBe('SELECT 1');
    });

    test('is null when there is no statement', () => {
        expect(statementAt('', 0, 'sqlite')).toBeNull();
        expect(statementAt('-- nothing', 3, 'mysql')).toBeNull();
    });

    test('does not split on a semicolon inside a string', () => {
        expect(statementAt("SELECT ';'; SELECT 2", 8, 'sqlite')?.text).toBe("SELECT ';'");
    });
});

describe('firstKeyword', () => {
    test('is the first word in upper case, past comments and parentheses', () => {
        expect(firstKeyword('  insert into a values (1)', 'sqlite')).toBe('INSERT');
        expect(firstKeyword('-- hi\n/* x */ Replace into a', 'mysql')).toBe('REPLACE');
        expect(firstKeyword('(select 1)', 'sqlite')).toBe('SELECT');
        expect(firstKeyword('', 'sqlite')).toBe('');
        expect(firstKeyword('1 + 1', 'sqlite')).toBe('');
    });
});

describe('tokenize', () => {
    test('gives every character that is not whitespace to a token', () => {
        const kinds = tokenize("a 'b' -- c\n(;", 'sqlite').map((token) => token.kind);
        expect(kinds).toEqual(['word', 'quoted', 'comment', 'punct', 'semicolon']);
    });
});
