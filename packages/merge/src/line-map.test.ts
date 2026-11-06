import { describe, expect, test } from 'bun:test';
import { diffLines } from './diff.ts';
import { lineMap } from './line-map.ts';

describe('lineMap', () => {
    test('maps every line to itself when nothing changed', () => {
        expect([...lineMap(['a', 'b', 'c'], ['a', 'b', 'c'])]).toEqual([0, 1, 2]);
        expect([...lineMap([], ['a'])]).toEqual([]);
    });

    test('shifts the lines after an insert and before a delete', () => {
        expect([...lineMap(['a', 'b', 'c'], ['a', 'x', 'y', 'b', 'c'])]).toEqual([0, 3, 4]);
        expect([...lineMap(['a', 'b', 'c', 'd'], ['a', 'd'])]).toEqual([0, -1, -1, 1]);
    });

    test('marks a line a change replaced and keeps the ones around it', () => {
        expect([...lineMap(['a', 'old', 'c'], ['a', 'new', 'extra', 'c'])]).toEqual([0, -1, 3]);
    });

    test('marks every line when the files share none', () => {
        expect([...lineMap(['a', 'b'], ['x', 'y', 'z'])]).toEqual([-1, -1]);
    });

    test('takes the changes of a caller that holds them', () => {
        const base = ['a', 'b', 'c'];
        const other = ['a', 'c'];

        expect([...lineMap(base, other, diffLines(base, other))]).toEqual([...lineMap(base, other)]);
    });

    test('points every kept line at an equal line of the other side', () => {
        const base = ['one', 'two', 'three', 'four', 'five', 'six'];
        const other = ['zero', 'one', 'three', 'FOUR', 'five', 'six', 'seven'];
        const map = lineMap(base, other);

        for (const [index, place] of map.entries()) {
            if (place >= 0) {
                expect(other[place]).toBe(base[index]!);
            }
        }

        expect([...map]).toEqual([1, -1, 2, -1, 4, 5]);
    });
});
