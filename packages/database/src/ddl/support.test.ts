import { describe, expect, test } from 'bun:test';
import {
    atLeast,
    dialectOf,
    draftOf,
    dropIndexSql,
    dropsColumns,
    dropTableSql,
    dropViewSql,
    emptyColumn,
    emptyDraft,
    optionsOf,
    renameTableSql,
    truncateTableSql,
    typeSuggestionsOf,
    validateDraft
} from './index.ts';
import { definitionOf, generatedClausesOf } from './parse.ts';

const mysql = dialectOf({ flavor: 'mariadb', version: '11.4.2-MariaDB' });
const sqlite = dialectOf({ flavor: 'sqlite', version: '3.45.1' });

describe('dialectOf', () => {
    test('reads the engine and the version from what the server answered', () => {
        expect(mysql).toEqual({ flavor: 'mariadb', engine: 'mysql', version: [11, 4, 2] });
        expect(sqlite.engine).toBe('sqlite');
        expect(dialectOf({ flavor: 'mysql', version: 'odd' }).version).toEqual([]);
    });

    test('compares versions part by part, and trusts one it cannot read', () => {
        expect(atLeast(sqlite, 3, 35)).toBe(true);
        expect(atLeast(sqlite, 3, 46)).toBe(false);
        expect(atLeast(sqlite, 4)).toBe(false);
        expect(atLeast(dialectOf({ flavor: 'sqlite', version: '' }), 9)).toBe(true);
    });
});

describe('the statements on a table', () => {
    test('drop, truncate, rename and index statements per dialect', () => {
        expect(dropTableSql(mysql, 'shop', 'a')).toBe('DROP TABLE `shop`.`a`');
        expect(dropViewSql(sqlite, 'main', 'v')).toBe('DROP VIEW "v"');
        expect(truncateTableSql(mysql, 'shop', 'a')).toBe('TRUNCATE TABLE `shop`.`a`');
        expect(truncateTableSql(sqlite, 'main', 'a')).toBe('DELETE FROM "a"');
        expect(renameTableSql(mysql, 'shop', 'a', 'b')).toBe('RENAME TABLE `shop`.`a` TO `shop`.`b`');
        expect(renameTableSql(sqlite, 'aux', 'a', 'b')).toBe('ALTER TABLE "aux"."a" RENAME TO "b"');
        expect(dropIndexSql(mysql, 'shop', 'a', 'ix')).toBe('DROP INDEX `ix` ON `shop`.`a`');
        expect(dropIndexSql(sqlite, 'aux', 'a', 'ix')).toBe('DROP INDEX "aux"."ix"');
    });

    test('offers the types of the engine', () => {
        expect(typeSuggestionsOf(sqlite)).toEqual(['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC']);
        expect(typeSuggestionsOf(mysql)).toContain('varchar(255)');
    });
});

describe('reading a CREATE TABLE', () => {
    test('splits the definitions at the commas that are not in a default, a type or a name', () => {
        const parsed = definitionOf("CREATE TABLE `a,b` (`x` decimal(10,2) DEFAULT 'a, (b', `y` int) ENGINE=InnoDB");
        expect(parsed?.items).toEqual(["`x` decimal(10,2) DEFAULT 'a, (b'", '`y` int']);
        expect(parsed?.tail.trim()).toBe('ENGINE=InnoDB');
        expect(definitionOf(null)).toBeNull();
        expect(definitionOf('CREATE VIEW v AS SELECT 1')).toBeNull();
    });

    test('finds the generated clause of a column and not the words in a string', () => {
        const clauses = generatedClausesOf(
            "CREATE TABLE t (a int, \"b\" int AS (a + 1) STORED, c text DEFAULT 'as (x)', `d` int GENERATED ALWAYS AS (concat(`c`, ')')) VIRTUAL)"
        );
        expect([...clauses]).toEqual([
            ['b', 'AS (a + 1) STORED'],
            ['d', "GENERATED ALWAYS AS (concat(`c`, ')')) VIRTUAL"]
        ]);
    });

    test('reads the options of MySQL and of SQLite', () => {
        expect(optionsOf({ ddl: "CREATE TABLE `t` (`a` int) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin COMMENT='it''s ) here'" })).toEqual({
            engine: 'MyISAM',
            charset: 'latin1',
            collation: 'latin1_bin',
            comment: "it's ) here",
            withoutRowid: false,
            strict: false
        });
        expect(optionsOf({ ddl: 'CREATE TABLE t (a) STRICT, WITHOUT ROWID' })).toMatchObject({ strict: true, withoutRowid: true, engine: '' });
        expect(optionsOf({ ddl: null }).strict).toBe(false);
    });
});

describe('validateDraft', () => {
    test('asks for a name, a column, and a type on MySQL', () => {
        expect(validateDraft(mysql, emptyDraft()).map((problem) => problem.code)).toEqual(['tableName', 'noColumns']);
        const draft = { ...emptyDraft(), name: 't', columns: [emptyColumn('a'), { ...emptyColumn('A'), type: 'int' }, emptyColumn('')] };
        expect(validateDraft(mysql, draft)).toEqual([
            { code: 'columnType', subject: 'a' },
            { code: 'columnDuplicate', subject: 'A' },
            { code: 'columnName', subject: '' }
        ]);
        expect(validateDraft(sqlite, draft).map((problem) => problem.code)).toEqual(['columnDuplicate', 'columnName']);
    });

    test('checks indexes and foreign keys', () => {
        const draft = {
            ...emptyDraft(),
            name: 't',
            columns: [{ ...emptyColumn('a'), type: 'int' }],
            indexes: [{ key: 'i', originalName: null, name: '', columns: [], unique: false }],
            foreignKeys: [
                {
                    key: 'f',
                    originalName: null,
                    name: 'fk',
                    columns: ['a'],
                    referencedSchema: 's',
                    referencedTable: 'u',
                    referencedColumns: [],
                    onUpdate: null,
                    onDelete: null
                }
            ]
        };
        expect(validateDraft(sqlite, draft).map((problem) => problem.code)).toEqual(['indexColumns', 'indexName', 'foreignKey']);
        expect(validateDraft(mysql, { ...draft, indexes: [], foreignKeys: [] })).toEqual([]);
    });

    test('knows whether a draft drops a column', () => {
        const draft = {
            ...draftOf({ schema: 's', name: 't', kind: 'table', columns: [], primaryKey: [], rowKey: null, indexes: [], foreignKeys: [], ddl: null }),
            name: 't'
        };
        const column = { ...emptyColumn('a'), originalName: 'a' };
        expect(dropsColumns({ ...draft, columns: [column] }, draft)).toBe(true);
        expect(dropsColumns({ ...draft, columns: [column] }, { ...draft, columns: [{ ...column, name: 'b' }] })).toBe(false);
    });
});
