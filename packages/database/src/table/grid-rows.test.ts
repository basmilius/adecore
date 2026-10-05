import { describe, expect, test } from 'bun:test';
import type { Cell, ResultColumn, TableStructure } from '../protocol/index.ts';
import { buildGridColumns, buildGridRows, cloneValues, insertedRowKey, loadedRowKey, parseRowKey } from './grid-rows.ts';
import { addInsert, emptyPending, markDeleted, setEdit, setInsertValue } from './pending.ts';

const columns: ResultColumn[] = [
    { name: 'id', type: 'INTEGER', kind: 'integer' },
    { name: 'name', type: 'TEXT', kind: 'text' }
];

const structure: TableStructure = {
    schema: 'main',
    name: 'users',
    kind: 'table',
    columns: [
        { name: 'id', type: 'INTEGER', kind: 'integer', nullable: false, defaultValue: null, autoIncrement: true, generated: false, comment: null },
        { name: 'name', type: 'TEXT', kind: 'text', nullable: true, defaultValue: null, autoIncrement: false, generated: true, comment: null }
    ],
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [],
    foreignKeys: [],
    ddl: null
};

const loaded = {
    columns,
    rows: [
        [1, 'Ada'],
        [{ kind: 'longText', preview: 'k', length: 9 }, 'Linus']
    ] as Cell[][]
};

describe('row keys', () => {
    test('round trip', () => {
        expect(parseRowKey(loadedRowKey(4))).toEqual({ kind: 'loaded', index: 4 });
        expect(parseRowKey(insertedRowKey(2))).toEqual({ kind: 'inserted', id: 2 });
    });
});

describe('buildGridColumns', () => {
    test('marks the primary key and takes the flags of the structure', () => {
        const [id, name] = buildGridColumns(loaded, structure);
        expect(id).toMatchObject({ name: 'id', primaryKey: true, nullable: false, readOnly: false });
        expect(name).toMatchObject({ primaryKey: false, nullable: true, readOnly: true });
    });

    test('knows nothing extra without a structure', () => {
        expect(buildGridColumns(loaded, null)[0]).toMatchObject({ primaryKey: false, readOnly: false });
    });
});

describe('buildGridRows', () => {
    test('numbers the rows from the offset and locks one whose key is a preview', () => {
        const rows = buildGridRows({ structure, loaded, pending: emptyPending, offset: 500 });
        expect(rows.map((row) => row.number)).toEqual([501, 502]);
        expect(rows.map((row) => row.locked)).toEqual([false, true]);
    });

    test('lays pending edits over the cells and names the edited ones', () => {
        const pending = setEdit(emptyPending, 0, 'name', 'Augusta', 'Ada');
        const [row] = buildGridRows({ structure, loaded, pending, offset: 0 });
        expect(row!.cells).toEqual([1, 'Augusta']);
        expect([...row!.edited!]).toEqual([1]);
    });

    test('marks a deleted row', () => {
        const [row] = buildGridRows({ structure, loaded, pending: markDeleted(emptyPending, [0]), offset: 0 });
        expect(row!.state).toBe('deleted');
    });

    test('draws inserted rows after the loaded ones, with DEFAULT where nothing was filled in', () => {
        const pending = setInsertValue(addInsert(emptyPending), 1, 'name', 'New');
        const rows = buildGridRows({ structure, loaded, pending, offset: 0 });
        const inserted = rows[2]!;
        expect(inserted).toMatchObject({ key: 'new:1', number: null, state: 'inserted', cells: [{ kind: 'default' }, 'New'] });
    });

    test('every row is locked without a structure', () => {
        expect(buildGridRows({ structure: null, loaded, pending: emptyPending, offset: 0 }).every((row) => row.locked)).toBe(true);
    });
});

describe('cloneValues', () => {
    const gridColumns = [
        { name: 'id', type: 'INTEGER', kind: 'integer' as const, autoIncrement: true },
        { name: 'name', type: 'TEXT', kind: 'text' as const },
        { name: 'slug', type: 'TEXT', kind: 'text' as const, readOnly: true },
        { name: 'bio', type: 'TEXT', kind: 'text' as const },
        { name: 'avatar', type: 'BLOB', kind: 'binary' as const },
        { name: 'note', type: 'TEXT', kind: 'text' as const }
    ];

    test('keeps the shown values except auto-increment, generated, preview and DEFAULT cells', () => {
        const values = cloneValues(gridColumns, [
            7,
            'Ada',
            'ada',
            { kind: 'longText', preview: 'abc', length: 900 },
            { kind: 'binary', hex: 'ab', length: 1 },
            { kind: 'default' }
        ]);
        expect(values).toEqual({ name: 'Ada', avatar: { kind: 'binary', hex: 'ab' } });
    });

    test('keeps an explicit NULL', () => {
        expect(cloneValues([gridColumns[1]!], [null])).toEqual({ name: null });
    });
});
