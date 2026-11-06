import { describe, expect, test } from 'bun:test';
import { matchRanges } from './highlight.ts';

describe('matching a query in a name', () => {
    test('finds every place it occurs, ignoring case', () => {
        expect(matchRanges('Button.test.tsx', 'T')).toEqual([
            [2, 3],
            [3, 4],
            [7, 8],
            [10, 11],
            [12, 13]
        ]);

        expect(matchRanges('SplitButton.tsx', 'button')).toEqual([[5, 11]]);

        expect(matchRanges('aaaa', 'aa')).toEqual([
            [0, 2],
            [2, 4]
        ]);
    });

    test('marks nothing for an empty query or one that is not there', () => {
        expect(matchRanges('index.ts', '')).toEqual([]);
        expect(matchRanges('index.ts', 'vue')).toEqual([]);
    });
});
