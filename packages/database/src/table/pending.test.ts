import { describe, expect, test } from 'bun:test';
import type { Cell, ResultColumn, TableStructure } from '../protocol/index.ts';
import {
    addInsert,
    addInsertWith,
    describeKey,
    emptyPending,
    hasRowChanges,
    isPendingEmpty,
    markDeleted,
    pendingCount,
    removeInsert,
    revertRow,
    revertRows,
    rowKeyOf,
    setEdit,
    setInsertValue,
    toRowChanges
} from './pending.ts';

const column = (name: string): ResultColumn => ({ name, type: 'TEXT', kind: 'text' });

const structure = (rowKey: readonly string[] | null): TableStructure => ({
    schema: 'main',
    name: 'users',
    kind: 'table',
    columns: [],
    primaryKey: rowKey ?? [],
    rowKey,
    indexes: [],
    foreignKeys: [],
    ddl: null
});

const loaded = {
    columns: [column('id'), column('name'), column('bio')],
    rows: [
        [1, 'Ada', 'x'],
        [2, 'Grace', { kind: 'longText', preview: 'abc', length: 9000 }],
        [{ kind: 'longText', preview: 'k', length: 900 }, 'Linus', null]
    ] as Cell[][]
};

describe('setEdit', () => {
    test('keeps an edit by row and column', () => {
        const pending = setEdit(emptyPending, 0, 'name', 'Augusta', 'Ada');
        expect(pending.edits).toEqual({ 0: { name: 'Augusta' } });
        expect(pendingCount(pending)).toBe(1);
    });

    test('two cells of one row are one change', () => {
        const pending = setEdit(setEdit(emptyPending, 0, 'name', 'A', 'Ada'), 0, 'bio', 'B', 'x');
        expect(pendingCount(pending)).toBe(1);
    });

    test('setting a cell back to its original removes the edit and the row with it', () => {
        const edited = setEdit(emptyPending, 0, 'name', 'Augusta', 'Ada');
        const back = setEdit(edited, 0, 'name', 'Ada', 'Ada');
        expect(back.edits).toEqual({});
        expect(isPendingEmpty(back)).toBe(true);
    });

    test('a preview is never equal to an edit, since the whole value is unknown', () => {
        const pending = setEdit(emptyPending, 1, 'bio', 'abc', { kind: 'longText', preview: 'abc', length: 9000 });
        expect(pending.edits).toEqual({ 1: { bio: 'abc' } });
    });

    test('NULL and DEFAULT are values of their own', () => {
        const nulled = setEdit(emptyPending, 0, 'bio', null, 'x');
        expect(nulled.edits[0]).toEqual({ bio: null });
        expect(setEdit(nulled, 0, 'bio', { kind: 'default' }, 'x').edits[0]).toEqual({ bio: { kind: 'default' } });
        expect(setEdit(emptyPending, 2, 'bio', null, null).edits).toEqual({});
    });

    test('does not change the pending set it is given', () => {
        const before = setEdit(emptyPending, 0, 'name', 'A', 'Ada');
        setEdit(before, 0, 'name', 'B', 'Ada');
        expect(before.edits).toEqual({ 0: { name: 'A' } });
    });
});

describe('inserts and deletes', () => {
    test('an inserted row gets an id and takes values', () => {
        const added = addInsert(addInsert(emptyPending));
        expect(added.inserts.map((row) => row.id)).toEqual([1, 2]);
        const filled = setInsertValue(added, 2, 'name', 'New');
        expect(filled.inserts[1]!.values).toEqual({ name: 'New' });
        expect(removeInsert(filled, 1).inserts.map((row) => row.id)).toEqual([2]);
    });

    test('a row marked for deletion counts once, with its edits', () => {
        const pending = markDeleted(setEdit(emptyPending, 0, 'name', 'A', 'Ada'), [0, 1]);
        expect(pendingCount(pending)).toBe(2);
    });

    test('reverting a row takes back its edits and its deletion', () => {
        const pending = revertRow(markDeleted(setEdit(emptyPending, 0, 'name', 'A', 'Ada'), [0]), 0);
        expect(isPendingEmpty(pending)).toBe(true);
    });

    test('counts every kind of change', () => {
        const pending = markDeleted(addInsert(setEdit(emptyPending, 0, 'name', 'A', 'Ada')), [1]);
        expect(pendingCount(pending)).toBe(3);
        expect(isPendingEmpty(pending)).toBe(false);
    });
});

describe('rowKeyOf', () => {
    test('reads the key from the original row values', () => {
        expect(rowKeyOf(structure(['id']), loaded, 1)).toEqual({ id: 2 });
    });

    test('a composite key has every column', () => {
        expect(rowKeyOf(structure(['id', 'name']), loaded, 0)).toEqual({ id: 1, name: 'Ada' });
    });

    test('is null without a row key, for a key cell that is a preview and for a missing row or column', () => {
        expect(rowKeyOf(structure(null), loaded, 0)).toBeNull();
        expect(rowKeyOf(structure(['id']), loaded, 2)).toBeNull();
        expect(rowKeyOf(structure(['id']), loaded, 9)).toBeNull();
        expect(rowKeyOf(structure(['missing']), loaded, 0)).toBeNull();
    });

    test('a whole binary key cell is a key; a cut one is not', () => {
        const binary = { columns: [column('id')], rows: [[{ kind: 'binary', hex: 'ab', length: 1 }], [{ kind: 'binary', hex: 'ab', length: 4 }]] as Cell[][] };
        expect(rowKeyOf(structure(['id']), binary, 0)).toEqual({ id: { kind: 'binary', hex: 'ab' } });
        expect(rowKeyOf(structure(['id']), binary, 1)).toBeNull();
    });
});

describe('toRowChanges', () => {
    test('writes updates, then deletes, then inserts', () => {
        let pending = setEdit(emptyPending, 1, 'name', 'G.', 'Grace');
        pending = setEdit(pending, 0, 'name', 'A.', 'Ada');
        pending = markDeleted(pending, [1]);
        pending = setInsertValue(addInsert(pending), 1, 'name', 'New');
        expect(toRowChanges(structure(['id']), loaded, pending)).toEqual([
            { kind: 'update', key: { id: 1 }, values: { name: 'A.' } },
            { kind: 'delete', key: { id: 2 } },
            { kind: 'insert', values: { name: 'New' } }
        ]);
    });

    test('an edit of a row that is also deleted is dropped', () => {
        const pending = markDeleted(setEdit(emptyPending, 0, 'name', 'A', 'Ada'), [0]);
        expect(toRowChanges(structure(['id']), loaded, pending)).toEqual([{ kind: 'delete', key: { id: 1 } }]);
    });

    test('refuses a change to a row that has no usable key', () => {
        const pending = setEdit(emptyPending, 2, 'name', 'L.', 'Linus');
        expect(() => toRowChanges(structure(['id']), loaded, pending)).toThrow();
        expect(() => toRowChanges(structure(null), loaded, setEdit(emptyPending, 0, 'name', 'A', 'Ada'))).toThrow();
    });

    test('nothing pending is no change', () => {
        expect(toRowChanges(structure(['id']), loaded, emptyPending)).toEqual([]);
    });
});

describe('describeKey', () => {
    test('writes a key the way a WHERE would', () => {
        expect(describeKey({ id: 5, tenant: 'a', gone: null, raw: { kind: 'binary', hex: 'ff' } })).toBe("id = 5, tenant = 'a', gone = NULL, raw = 0xff");
    });
});

describe('addInsertWith', () => {
    test('adds a row that starts from the given values', () => {
        const next = addInsertWith(addInsert(emptyPending), { name: 'Ada' });
        expect(next.inserts).toEqual([
            { id: 1, values: {} },
            { id: 2, values: { name: 'Ada' } }
        ]);
    });
});

describe('revertRows', () => {
    const changed = markDeleted(
        setInsertValue(addInsert(addInsert(setEdit(setEdit(emptyPending, 0, 'name', 'x', 'a'), 1, 'name', 'y', 'b'))), 1, 'name', 'z'),
        [0, 2]
    );

    test('takes back the edits and deletion of the given loaded rows only', () => {
        const next = revertRows(changed, { loaded: [0], inserted: [] });
        expect(next.edits[0]).toBeUndefined();
        expect(next.edits[1]).toEqual({ name: 'y' });
        expect([...next.deletes]).toEqual([2]);
        expect(next.inserts).toHaveLength(2);
    });

    test('drops the given inserted rows', () => {
        const next = revertRows(changed, { loaded: [], inserted: [1] });
        expect(next.inserts.map((row) => row.id)).toEqual([2]);
        expect(next.edits[0]).toEqual({ name: 'x' });
    });
});

describe('hasRowChanges', () => {
    const changed = markDeleted(addInsert(setEdit(emptyPending, 0, 'name', 'x', 'a')), [3]);

    test('is true for a row with an edit, a deletion mark or an insert', () => {
        expect(hasRowChanges(changed, { loaded: [0], inserted: [] })).toBe(true);
        expect(hasRowChanges(changed, { loaded: [3], inserted: [] })).toBe(true);
        expect(hasRowChanges(changed, { loaded: [], inserted: [1] })).toBe(true);
    });

    test('is false for rows nobody touched', () => {
        expect(hasRowChanges(changed, { loaded: [1, 2], inserted: [9] })).toBe(false);
        expect(hasRowChanges(emptyPending, { loaded: [0], inserted: [1] })).toBe(false);
    });
});
