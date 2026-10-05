import { describe, expect, test } from 'bun:test';
import { dialectOf, draftOf, emptyColumn, emptyDraft } from '../ddl/index.ts';
import type { TableStructure } from '../protocol/index.ts';
import { addColumn, patchColumn, removeColumn, renameTable } from './edit.ts';
import { planOf, scriptOf } from './plan.ts';

const mysql = dialectOf({ flavor: 'mysql', version: '8.0.36' });

const structure: TableStructure = {
    schema: 'shop',
    name: 'tags',
    kind: 'table',
    columns: [{ name: 'id', type: 'int', kind: 'integer', nullable: false, defaultValue: null, autoIncrement: false, generated: false, comment: null }],
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [],
    foreignKeys: [],
    ddl: null
};

describe('planOf', () => {
    test('plans a CREATE for a table that does not exist yet', () => {
        const draft = { ...renameTable(emptyDraft(), 'tags'), columns: [{ ...emptyColumn('id'), type: 'int' }] };
        const plan = planOf(mysql, 'shop', null, draft);
        expect(plan.statements).toEqual(['CREATE TABLE `shop`.`tags` (\n    `id` int NULL\n)']);
        expect(plan.destructive).toBe(false);
    });

    test('plans nothing for a draft that changes nothing', () => {
        expect(planOf(mysql, 'shop', structure, draftOf(structure))).toEqual({ problems: [], statements: [], destructive: false });
    });

    test('plans an ALTER and calls a dropped column destructive', () => {
        const draft = draftOf(structure);
        expect(planOf(mysql, 'shop', structure, addColumn(draft, 'int')).statements).toEqual(['ALTER TABLE `shop`.`tags`\n    ADD COLUMN `column_2` int NULL']);
        const dropped = planOf(mysql, 'shop', structure, removeColumn(addColumn(draft, 'int'), draft.columns[0]!.key));
        expect(dropped.destructive).toBe(true);
        expect(planOf(mysql, 'shop', structure, patchColumn(draft, draft.columns[0]!.key, { name: 'tag_id' })).destructive).toBe(false);
    });

    test('has no statements while the draft has problems', () => {
        const plan = planOf(mysql, 'shop', structure, renameTable(draftOf(structure), ''));
        expect(plan.problems).toEqual([{ code: 'tableName', subject: '' }]);
        expect(plan.statements).toEqual([]);
    });

    test('writes a script with a semicolon after every statement', () => {
        expect(scriptOf(['A', 'B'])).toBe('A;\nB;');
        expect(scriptOf([])).toBe('');
    });
});
