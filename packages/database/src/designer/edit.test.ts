import { describe, expect, test } from 'bun:test';
import { draftOf, emptyDraft, type TableDraft } from '../ddl/index.ts';
import type { TableStructure } from '../protocol/index.ts';
import {
    addColumn,
    addForeignKey,
    addIndex,
    moveColumn,
    patchColumn,
    patchOptions,
    removeColumn,
    removeForeignKey,
    removeIndex,
    renameTable,
    setReferencedTable,
    toggleForeignKeyColumn,
    toggleIndexColumn,
    togglePrimaryKey
} from './edit.ts';

const structure: TableStructure = {
    schema: 'shop',
    name: 'orders',
    kind: 'table',
    columns: ['id', 'user_id', 'total'].map((name) => ({
        name,
        type: 'int',
        kind: 'integer',
        nullable: name === 'total',
        defaultValue: null,
        autoIncrement: false,
        generated: false,
        comment: null
    })),
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [
        { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
        { name: 'idx_total', columns: ['user_id', 'total'], unique: false, primary: false }
    ],
    foreignKeys: [
        { name: 'fk_user', columns: ['user_id'], referencedSchema: 'shop', referencedTable: 'users', referencedColumns: ['id'], onUpdate: null, onDelete: null }
    ],
    ddl: null
};

const base = draftOf(structure);
const keyOf = (draft: TableDraft, name: string): string => draft.columns.find((column) => column.name === name)!.key;
const names = (draft: TableDraft): string[] => draft.columns.map((column) => column.name);

describe('editing columns', () => {
    test('adds a column of the given type at the end', () => {
        const next = addColumn(base, 'int');
        expect(names(next)).toEqual(['id', 'user_id', 'total', 'column_4']);
        expect(next.columns[3]).toMatchObject({ type: 'int', originalName: null, nullable: true });
        expect(base.columns).toHaveLength(3);
    });

    test('a rename follows the key, the indexes and the foreign keys', () => {
        const next = patchColumn(patchColumn(base, keyOf(base, 'user_id'), { name: 'buyer_id' }), keyOf(base, 'id'), { name: 'order_id' });
        expect(next.primaryKey).toEqual(['order_id']);
        expect(next.indexes[0]!.columns).toEqual(['buyer_id', 'total']);
        expect(next.foreignKeys[0]!.columns).toEqual(['buyer_id']);
        expect(next.columns[1]).toMatchObject({ name: 'buyer_id', originalName: 'user_id' });
    });

    test('a column in the primary key stays not null', () => {
        expect(patchColumn(base, keyOf(base, 'id'), { nullable: true }).columns[0]!.nullable).toBe(false);
        expect(patchColumn(base, keyOf(base, 'total'), { nullable: false }).columns[2]!.nullable).toBe(false);
    });

    test('removing a column leaves an index its other columns and takes a foreign key with it', () => {
        const next = removeColumn(base, keyOf(base, 'user_id'));
        expect(names(next)).toEqual(['id', 'total']);
        expect(next.indexes[0]!.columns).toEqual(['total']);
        expect(next.foreignKeys).toEqual([]);
        expect(removeColumn(removeColumn(base, keyOf(base, 'user_id')), keyOf(base, 'total')).indexes).toEqual([]);
        expect(removeColumn(base, keyOf(base, 'id')).primaryKey).toEqual([]);
    });

    test('moves a column one place and stops at the ends', () => {
        expect(names(moveColumn(base, keyOf(base, 'total'), -1))).toEqual(['id', 'total', 'user_id']);
        expect(names(moveColumn(base, keyOf(base, 'id'), -1))).toEqual(['id', 'user_id', 'total']);
        expect(names(moveColumn(base, keyOf(base, 'total'), 1))).toEqual(['id', 'user_id', 'total']);
    });

    test('puts a column in the primary key and takes it out again', () => {
        const joined = togglePrimaryKey(base, keyOf(base, 'total'));
        expect(joined.primaryKey).toEqual(['id', 'total']);
        expect(joined.columns[2]!.nullable).toBe(false);
        expect(togglePrimaryKey(joined, keyOf(base, 'id')).primaryKey).toEqual(['total']);
    });
});

describe('editing indexes and foreign keys', () => {
    test('adds an index, picks its columns in order and removes it', () => {
        const added = addIndex(renameTable(base, 'orders'));
        const index = added.indexes[1]!;
        expect(index).toMatchObject({ name: 'idx_orders_2', columns: [], unique: false, originalName: null });
        const picked = toggleIndexColumn(toggleIndexColumn(added, index.key, 'total'), index.key, 'id');
        expect(picked.indexes[1]!.columns).toEqual(['total', 'id']);
        expect(toggleIndexColumn(picked, index.key, 'total').indexes[1]!.columns).toEqual(['id']);
        expect(removeIndex(picked, index.key).indexes).toHaveLength(1);
    });

    test('adds a foreign key, forgets the referenced columns with the table, and removes it', () => {
        const added = addForeignKey(base, 'shop');
        const key = added.foreignKeys[1]!;
        expect(key).toMatchObject({ referencedSchema: 'shop', referencedTable: '', originalName: null });
        const referenced = toggleForeignKeyColumn(setReferencedTable(added, key.key, 'shop', 'users'), key.key, 'referencedColumns', 'id');
        expect(referenced.foreignKeys[1]).toMatchObject({ referencedTable: 'users', referencedColumns: ['id'] });
        expect(setReferencedTable(referenced, key.key, 'shop', 'groups').foreignKeys[1]!.referencedColumns).toEqual([]);
        expect(toggleForeignKeyColumn(referenced, key.key, 'columns', 'total').foreignKeys[1]!.columns).toEqual(['total']);
        expect(removeForeignKey(referenced, key.key).foreignKeys).toHaveLength(1);
    });
});

describe('editing options', () => {
    test('choosing another character set empties the collation, and naming both keeps it', () => {
        const draft: TableDraft = { ...emptyDraft(), options: { ...emptyDraft().options, charset: 'latin1', collation: 'latin1_bin' } };
        expect(patchOptions(draft, { charset: 'utf8mb4' }).options).toMatchObject({ charset: 'utf8mb4', collation: '' });
        expect(patchOptions(draft, { charset: 'utf8mb4', collation: 'utf8mb4_bin' }).options.collation).toBe('utf8mb4_bin');
        expect(patchOptions(draft, { comment: 'x' }).options.collation).toBe('latin1_bin');
    });
});
