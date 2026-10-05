import { describe, expect, test } from 'bun:test';
import { sortOnly, sortStateOf } from './sort.ts';

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
