import { describe, expect, test } from 'bun:test';
import { NO_COLUMN_SELECTION, selectColumn, shownSelection } from './column-selection.ts';

const plain = { shiftKey: false, mod: false };
const order = [0, 1, 2, 3, 4];

describe('selectColumn', () => {
    test('a plain click picks the column alone and makes it the anchor', () => {
        const picked = selectColumn(NO_COLUMN_SELECTION, order, 2, plain);
        expect([...picked.columns]).toEqual([2]);
        expect(picked.anchor).toBe(2);
        expect([...selectColumn(picked, order, 3, plain).columns]).toEqual([3]);
    });

    test('Mod toggles a column and moves the anchor to one it adds', () => {
        let picked = selectColumn(NO_COLUMN_SELECTION, order, 1, plain);
        picked = selectColumn(picked, order, 3, { shiftKey: false, mod: true });
        expect([...picked.columns].sort()).toEqual([1, 3]);
        expect(picked.anchor).toBe(3);
        picked = selectColumn(picked, order, 1, { shiftKey: false, mod: true });
        expect([...picked.columns]).toEqual([3]);
    });

    test('toggling the last column off leaves nothing picked and no anchor', () => {
        const picked = selectColumn(selectColumn(NO_COLUMN_SELECTION, order, 1, plain), order, 1, { shiftKey: false, mod: true });
        expect(picked.columns.size).toBe(0);
        expect(picked.anchor).toBeNull();
    });

    test('Shift picks the range from the anchor, whichever way it runs', () => {
        const start = selectColumn(NO_COLUMN_SELECTION, order, 3, plain);
        expect([...selectColumn(start, order, 1, { shiftKey: true, mod: false }).columns].sort()).toEqual([1, 2, 3]);
        expect([...selectColumn(start, order, 4, { shiftKey: true, mod: false }).columns].sort()).toEqual([3, 4]);
        expect(selectColumn(start, order, 1, { shiftKey: true, mod: false }).anchor).toBe(3);
    });

    test('Shift with Mod adds the range to the columns already picked', () => {
        let picked = selectColumn(NO_COLUMN_SELECTION, order, 0, plain);
        picked = selectColumn(picked, order, 3, { shiftKey: false, mod: true });
        picked = selectColumn(picked, order, 4, { shiftKey: true, mod: true });
        expect([...picked.columns].sort()).toEqual([0, 3, 4]);
    });

    test('a range follows the columns as drawn, not as given', () => {
        const drawn = [2, 0, 1];
        const start = selectColumn(NO_COLUMN_SELECTION, drawn, 2, plain);
        expect([...selectColumn(start, drawn, 0, { shiftKey: true, mod: false }).columns].sort()).toEqual([0, 2]);
        expect([...selectColumn(start, drawn, 1, { shiftKey: true, mod: false }).columns].sort()).toEqual([0, 1, 2]);
    });

    test('Shift without an anchor picks the column alone', () => {
        expect([...selectColumn(NO_COLUMN_SELECTION, order, 2, { shiftKey: true, mod: false }).columns]).toEqual([2]);
    });

    test('ignores a column that is not drawn', () => {
        expect(selectColumn(NO_COLUMN_SELECTION, [0, 1], 5, plain)).toBe(NO_COLUMN_SELECTION);
    });
});

describe('shownSelection', () => {
    test('lists the picked columns that are drawn, in drawing order', () => {
        const picked = { columns: new Set([0, 2, 9]), anchor: 0 };
        expect(shownSelection(picked, [2, 1, 0])).toEqual([2, 0]);
    });
});
