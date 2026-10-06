import { describe, expect, test } from 'bun:test';
import { foldRangesOf } from './folding.ts';

describe('the ranges a server folds', () => {
    test('keep where a range starts and ends within its lines, and drop a range of one line', () => {
        expect(
            foldRangesOf([
                { startLine: 1, startCharacter: 3, endLine: 3, endCharacter: 9, kind: 'imports' },
                { startLine: 5, endLine: 8 },
                { startLine: 9, endLine: 9 }
            ])
        ).toEqual([
            { startLine: 1, endLine: 3, kind: 'imports', startCharacter: 3, endCharacter: 9 },
            { startLine: 5, endLine: 8 }
        ]);
        expect(foldRangesOf(null)).toEqual([]);
    });
});
