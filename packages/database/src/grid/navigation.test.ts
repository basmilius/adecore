import { describe, expect, test } from 'bun:test';
import { moveFocus } from './navigation.ts';

const SIZE = { rows: 10, columns: 4, page: 5 };
const key = (name: string, shiftKey = false, mod = false) => ({ key: name, shiftKey, mod });

describe('moveFocus', () => {
    test('the first navigation key lands on the first cell', () => {
        expect(moveFocus(null, key('ArrowDown'), SIZE)).toEqual({ row: 0, column: 0 });
    });

    test('arrows move by one and stop at the edges', () => {
        expect(moveFocus({ row: 2, column: 2 }, key('ArrowUp'), SIZE)).toEqual({ row: 1, column: 2 });
        expect(moveFocus({ row: 0, column: 0 }, key('ArrowUp'), SIZE)).toEqual({ row: 0, column: 0 });
        expect(moveFocus({ row: 9, column: 3 }, key('ArrowRight'), SIZE)).toEqual({ row: 9, column: 3 });
    });

    test('Home and End go to the first and last column, with Mod to the first and last cell', () => {
        expect(moveFocus({ row: 4, column: 2 }, key('Home'), SIZE)).toEqual({ row: 4, column: 0 });
        expect(moveFocus({ row: 4, column: 2 }, key('End'), SIZE)).toEqual({ row: 4, column: 3 });
        expect(moveFocus({ row: 4, column: 2 }, key('Home', false, true), SIZE)).toEqual({ row: 0, column: 0 });
        expect(moveFocus({ row: 4, column: 2 }, key('End', false, true), SIZE)).toEqual({ row: 9, column: 3 });
    });

    test('page keys move by a page', () => {
        expect(moveFocus({ row: 2, column: 1 }, key('PageDown'), SIZE)).toEqual({ row: 7, column: 1 });
        expect(moveFocus({ row: 2, column: 1 }, key('PageUp'), SIZE)).toEqual({ row: 0, column: 1 });
    });

    test('Tab wraps to the next row and leaves the grid at its last cell', () => {
        expect(moveFocus({ row: 1, column: 3 }, key('Tab'), SIZE)).toEqual({ row: 2, column: 0 });
        expect(moveFocus({ row: 9, column: 3 }, key('Tab'), SIZE)).toBeNull();
    });

    test('Shift+Tab goes back and leaves the grid at its first cell', () => {
        expect(moveFocus({ row: 2, column: 0 }, key('Tab', true), SIZE)).toEqual({ row: 1, column: 3 });
        expect(moveFocus({ row: 0, column: 0 }, key('Tab', true), SIZE)).toBeNull();
    });

    test('other keys and an empty grid move nothing', () => {
        expect(moveFocus({ row: 0, column: 0 }, key('a'), SIZE)).toBeNull();
        expect(moveFocus(null, key('ArrowDown'), { rows: 0, columns: 3, page: 5 })).toBeNull();
    });

    test('a position beyond the grid is pulled back inside', () => {
        expect(moveFocus({ row: 50, column: 50 }, key('ArrowUp'), SIZE)).toEqual({ row: 8, column: 3 });
    });
});
