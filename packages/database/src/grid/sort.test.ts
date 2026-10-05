import { describe, expect, test } from 'bun:test';
import { cycleSort, sortOnly, sortStateOf } from './sort.ts';

describe('cycleSort', () => {
    test('goes ascending, descending, off', () => {
        let sorts = cycleSort([], 'name', false);
        expect(sorts).toEqual([{ column: 'name', direction: 'asc' }]);
        sorts = cycleSort(sorts, 'name', false);
        expect(sorts).toEqual([{ column: 'name', direction: 'desc' }]);
        sorts = cycleSort(sorts, 'name', false);
        expect(sorts).toEqual([]);
    });

    test('a plain click on another column replaces the sorts', () => {
        expect(
            cycleSort(
                [
                    { column: 'a', direction: 'asc' },
                    { column: 'b', direction: 'desc' }
                ],
                'c',
                false
            )
        ).toEqual([{ column: 'c', direction: 'asc' }]);
    });

    test('a plain click on a column among several keeps only it, one step on', () => {
        expect(
            cycleSort(
                [
                    { column: 'a', direction: 'asc' },
                    { column: 'b', direction: 'asc' }
                ],
                'b',
                false
            )
        ).toEqual([{ column: 'b', direction: 'desc' }]);
    });

    test('Shift adds a secondary sort, cycles it in place and removes it', () => {
        let sorts = cycleSort([{ column: 'a', direction: 'asc' }], 'b', true);
        expect(sorts).toEqual([
            { column: 'a', direction: 'asc' },
            { column: 'b', direction: 'asc' }
        ]);
        sorts = cycleSort(sorts, 'a', true);
        expect(sorts).toEqual([
            { column: 'a', direction: 'desc' },
            { column: 'b', direction: 'asc' }
        ]);
        sorts = cycleSort(sorts, 'a', true);
        expect(sorts).toEqual([{ column: 'b', direction: 'asc' }]);
    });
});

describe('sortOnly and sortStateOf', () => {
    test('sortOnly makes one sort', () => {
        expect(sortOnly('x', 'desc')).toEqual([{ column: 'x', direction: 'desc' }]);
    });

    test('sortStateOf gives the direction and the place counted from one', () => {
        const sorts = [
            { column: 'a', direction: 'asc' as const },
            { column: 'b', direction: 'desc' as const }
        ];
        expect(sortStateOf(sorts, 'b')).toEqual({ direction: 'desc', position: 2 });
        expect(sortStateOf(sorts, 'z')).toBeNull();
    });
});
