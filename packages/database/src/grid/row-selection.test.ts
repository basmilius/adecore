import { describe, expect, test } from 'bun:test';
import { selectRow } from './row-selection.ts';

const KEYS = ['a', 'b', 'c', 'd', 'e'];
const plain = { shiftKey: false, mod: false };

describe('selectRow', () => {
    test('a plain click selects that row alone and makes it the anchor', () => {
        const result = selectRow(KEYS, new Set(['a', 'b']), 0, 3, plain);
        expect([...result.selected]).toEqual(['d']);
        expect(result.anchor).toBe(3);
    });

    test('Mod toggles a row in and out', () => {
        const added = selectRow(KEYS, new Set(['a']), 0, 2, { shiftKey: false, mod: true });
        expect([...added.selected]).toEqual(['a', 'c']);
        const removed = selectRow(KEYS, added.selected, added.anchor, 2, { shiftKey: false, mod: true });
        expect([...removed.selected]).toEqual(['a']);
    });

    test('Shift selects the range from the anchor, in either direction', () => {
        expect([...selectRow(KEYS, new Set(['b']), 1, 3, { shiftKey: true, mod: false }).selected]).toEqual(['b', 'c', 'd']);
        expect([...selectRow(KEYS, new Set(['d']), 3, 1, { shiftKey: true, mod: false }).selected]).toEqual(['b', 'c', 'd']);
    });

    test('Shift with Mod adds the range to what is selected', () => {
        const result = selectRow(KEYS, new Set(['a']), 2, 4, { shiftKey: true, mod: true });
        expect([...result.selected].sort()).toEqual(['a', 'c', 'd', 'e']);
    });

    test('Shift without an anchor selects the row alone', () => {
        expect([...selectRow(KEYS, new Set(), -1, 2, { shiftKey: true, mod: false }).selected]).toEqual(['c']);
    });

    test('a click on a row that does not exist changes nothing', () => {
        const current = new Set(['a']);
        expect(selectRow(KEYS, current, 0, 9, plain).selected).toBe(current);
    });
});
