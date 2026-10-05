import { describe, expect, test } from 'bun:test';
import type { ColumnInfo, TableStructure } from '../protocol/index.ts';
import { alterTableSql, createTableSql, dialectOf, draftOf, emptyColumn, emptyDraft, type ColumnDraft, type TableDraft } from './index.ts';

const sqlite = dialectOf({ flavor: 'sqlite', version: '3.45.1' });

const column = (name: string, type: string, extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
    name,
    type,
    kind: 'text',
    nullable: true,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null,
    ...extra
});

const structure: TableStructure = {
    schema: 'main',
    name: 'notes',
    kind: 'table',
    columns: [
        column('id', 'INTEGER', { nullable: false, autoIncrement: true }),
        column('title', 'TEXT', { nullable: false }),
        column('body', 'TEXT'),
        column('author_id', 'INTEGER')
    ],
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [
        { name: 'idx_title', columns: ['title'], unique: false, primary: false },
        { name: 'sqlite_autoindex_notes_1', columns: ['body'], unique: true, primary: false }
    ],
    foreignKeys: [],
    ddl: 'CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title TEXT NOT NULL, body TEXT UNIQUE, author_id INTEGER) STRICT'
};

const base = draftOf(structure);
const alter = (draft: TableDraft, schema = 'main', old = sqlite): string[] => alterTableSql(old, schema, structure, draft);
const named = (name: string): ColumnDraft => base.columns.find((candidate) => candidate.name === name)!;
const added = (name: string, type: string, rest: Partial<ColumnDraft> = {}): ColumnDraft => ({ ...emptyColumn(name), type, ...rest });
const replace = (name: string, rest: Partial<ColumnDraft>): TableDraft => ({
    ...base,
    columns: base.columns.map((candidate) => (candidate.name === name ? { ...candidate, ...rest } : candidate))
});

describe('createTableSql for SQLite', () => {
    test('declares AUTOINCREMENT on the key column and the options after the table', () => {
        expect(createTableSql(sqlite, 'main', base)).toEqual([
            [
                'CREATE TABLE "notes" (',
                '    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,',
                '    "title" TEXT NOT NULL,',
                '    "body" TEXT,',
                '    "author_id" INTEGER,',
                '    UNIQUE ("body")',
                ') STRICT'
            ].join('\n'),
            'CREATE INDEX "idx_title" ON "notes" ("title")'
        ]);
    });

    test('writes a composite key, a foreign key and an index in an attached schema', () => {
        const draft: TableDraft = {
            ...emptyDraft(),
            name: 'tag"s',
            columns: [added('a', 'INTEGER', { nullable: false }), added('b', 'INTEGER', { nullable: false, defaultValue: '0' })],
            primaryKey: ['a', 'b'],
            indexes: [{ key: 'i', originalName: null, name: 'ix', columns: ['b'], unique: true }],
            foreignKeys: [
                {
                    key: 'f',
                    originalName: null,
                    name: '',
                    columns: ['a'],
                    referencedSchema: 'aux',
                    referencedTable: 'notes',
                    referencedColumns: ['id'],
                    onUpdate: null,
                    onDelete: 'CASCADE'
                }
            ],
            options: { ...emptyDraft().options, withoutRowid: true }
        };
        expect(createTableSql(sqlite, 'aux', draft)).toEqual([
            [
                'CREATE TABLE "aux"."tag""s" (',
                '    "a" INTEGER NOT NULL,',
                '    "b" INTEGER NOT NULL DEFAULT 0,',
                '    PRIMARY KEY ("a", "b"),',
                '    FOREIGN KEY ("a") REFERENCES "notes" ("id") ON DELETE CASCADE',
                ') WITHOUT ROWID'
            ].join('\n'),
            'CREATE UNIQUE INDEX "aux"."ix" ON "tag""s" ("b")'
        ]);
    });

    test('leaves AUTOINCREMENT off a WITHOUT ROWID table, which has no rowid to count', () => {
        const [table] = createTableSql(sqlite, 'main', { ...base, options: { ...base.options, withoutRowid: true } });
        expect(table).not.toContain('AUTOINCREMENT');
        expect(table).toContain('PRIMARY KEY ("id")');
    });

    test('leaves out the type of a column that has none', () => {
        const draft = { ...emptyDraft(), name: 't', columns: [added('a', '')] };
        expect(createTableSql(sqlite, 'main', draft)[0]).toContain('"a"\n');
    });
});

describe('alterTableSql for SQLite', () => {
    test('says nothing for a draft that changes nothing, and ignores a comment', () => {
        expect(alter(base)).toEqual([]);
        expect(alter(replace('body', { comment: 'ignored' }))).toEqual([]);
    });

    test('adds a column at the end with ADD COLUMN', () => {
        expect(alter({ ...base, columns: [...base.columns, added('pinned', 'INTEGER', { nullable: false, defaultValue: '0' })] })).toEqual([
            'ALTER TABLE "notes" ADD COLUMN "pinned" INTEGER NOT NULL DEFAULT 0'
        ]);
    });

    test('renames a column and the table without a rebuild', () => {
        const draft = { ...replace('title', { name: 'heading' }), name: 'memos', indexes: [{ ...base.indexes[0]!, columns: ['heading'] }, base.indexes[1]!] };
        expect(alter(draft)).toEqual(['ALTER TABLE "notes" RENAME COLUMN "title" TO "heading"', 'ALTER TABLE "notes" RENAME TO "memos"']);
    });

    test('drops a column that no index holds, after the index that does', () => {
        const draft: TableDraft = { ...base, columns: base.columns.filter((candidate) => candidate.name !== 'author_id') };
        expect(alter(draft)).toEqual(['ALTER TABLE "notes" DROP COLUMN "author_id"']);
        expect(alter({ ...draft, columns: draft.columns.filter((candidate) => candidate.name !== 'title'), indexes: [base.indexes[1]!] })).toEqual([
            'DROP INDEX "idx_title"',
            'ALTER TABLE "notes" DROP COLUMN "title"',
            'ALTER TABLE "notes" DROP COLUMN "author_id"'
        ]);
    });

    test('creates, drops and renames an index', () => {
        const fresh = { key: 'n', originalName: null, name: 'idx_body', columns: ['body', 'title'], unique: false };
        expect(alter({ ...base, indexes: [...base.indexes, fresh] })).toEqual(['CREATE INDEX "idx_body" ON "notes" ("body", "title")']);
        expect(alter({ ...base, indexes: [base.indexes[1]!] })).toEqual(['DROP INDEX "idx_title"']);
        expect(alter({ ...base, indexes: [{ ...base.indexes[0]!, name: 'idx_heading' }, base.indexes[1]!] }, 'aux')).toEqual([
            'DROP INDEX "aux"."idx_title"',
            'CREATE INDEX "aux"."idx_heading" ON "notes" ("title")'
        ]);
    });

    test('rebuilds the table for a new type, the way SQLite documents', () => {
        expect(alter(replace('title', { type: 'VARCHAR(5)', name: 'heading' }))).toEqual([
            'PRAGMA foreign_keys=OFF',
            'BEGIN',
            [
                'CREATE TABLE "new_notes" (',
                '    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,',
                '    "heading" VARCHAR(5) NOT NULL,',
                '    "body" TEXT,',
                '    "author_id" INTEGER,',
                '    UNIQUE ("body")',
                ') STRICT'
            ].join('\n'),
            'INSERT INTO "new_notes" ("id", "heading", "body", "author_id") SELECT "id", "title", "body", "author_id" FROM "notes"',
            'DROP TABLE "notes"',
            'ALTER TABLE "new_notes" RENAME TO "notes"',
            'CREATE INDEX "idx_title" ON "notes" ("title")',
            'PRAGMA foreign_key_check',
            'COMMIT',
            'PRAGMA foreign_keys=ON'
        ]);
    });

    test('keeps the indexes the draft keeps and copies only the columns that survive', () => {
        const draft: TableDraft = { ...base, columns: base.columns.filter((candidate) => candidate.name !== 'body'), indexes: [base.indexes[0]!] };
        const statements = alter({ ...draft, columns: [...draft.columns, added('pinned', 'INTEGER')] });
        expect(statements).toContain('INSERT INTO "new_notes" ("id", "title", "author_id") SELECT "id", "title", "author_id" FROM "notes"');
        expect(statements).toContain('CREATE INDEX "idx_title" ON "notes" ("title")');
        expect(statements.join('\n')).not.toContain('UNIQUE');
    });

    test('rebuilds for a change of key, a foreign key, a move, nullability, a default and the options', () => {
        const key = {
            key: 'f',
            originalName: null,
            name: 'fk',
            columns: ['author_id'],
            referencedSchema: 'main',
            referencedTable: 'users',
            referencedColumns: ['id'],
            onUpdate: null,
            onDelete: null
        };
        const changes: TableDraft[] = [
            { ...base, primaryKey: [] },
            { ...base, foreignKeys: [key] },
            { ...base, columns: [named('title'), named('id'), named('body'), named('author_id')] },
            replace('body', { nullable: false }),
            replace('body', { defaultValue: "'x'" }),
            { ...base, options: { ...base.options, withoutRowid: true } }
        ];
        for (const draft of changes) {
            expect(alter(draft)[0]).toBe('PRAGMA foreign_keys=OFF');
        }
    });

    test('rebuilds for a column ADD COLUMN cannot take', () => {
        const columns = [
            added('a', 'INTEGER', { nullable: false }),
            added('b', 'TEXT', { defaultValue: 'CURRENT_TIMESTAMP' }),
            added('c', 'TEXT', { defaultValue: 'lower(1)' }),
            added('d', 'INTEGER', { autoIncrement: true })
        ];
        for (const fresh of columns) {
            expect(alter({ ...base, columns: [...base.columns, fresh] })[0]).toBe('PRAGMA foreign_keys=OFF');
        }
    });

    test('rebuilds to put a new column in the middle', () => {
        const [id, ...rest] = base.columns;
        expect(alter({ ...base, columns: [id!, added('x', 'TEXT'), ...rest] })[0]).toBe('PRAGMA foreign_keys=OFF');
    });

    test('rebuilds where the server is too old for DROP COLUMN or RENAME COLUMN', () => {
        const old = dialectOf({ flavor: 'sqlite', version: '3.24.0' });
        const dropped = { ...base, columns: base.columns.filter((candidate) => candidate.name !== 'author_id') };
        expect(alter(dropped, 'main', old)[0]).toBe('PRAGMA foreign_keys=OFF');
        expect(alter({ ...replace('body', { name: 'text' }), indexes: [base.indexes[0]!, { ...base.indexes[1]!, columns: ['text'] }] }, 'main', old)[0]).toBe(
            'PRAGMA foreign_keys=OFF'
        );
    });

    test('rebuilds when a column of a UNIQUE constraint is dropped', () => {
        const draft: TableDraft = { ...base, columns: base.columns.filter((candidate) => candidate.name !== 'body'), indexes: [base.indexes[0]!] };
        expect(alter(draft)[0]).toBe('PRAGMA foreign_keys=OFF');
    });
});
