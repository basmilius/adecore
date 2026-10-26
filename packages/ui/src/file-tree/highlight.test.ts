import { describe, expect, test } from 'bun:test';
import { matchRanges, rangesOfMatches } from './highlight.ts';

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

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/file-tree/highlight.test.ts`.
describe.skipIf(typeof document === 'undefined')('marking the matches in the rows of a tree', () => {
    const rowOf = (html: string): HTMLElement => {
        const row = document.createElement('button');
        row.innerHTML = `<div data-item-section="icon"></div><div data-item-section="content">${html}</div>`;

        return row;
    };

    test('covers a match that runs across the parts the name is split into', () => {
        const row = rowOf('<span data-truncate-content="visible"><span>Split</span><span>Button.tsx</span></span>');
        const [range] = rangesOfMatches([row], 'tbut');
        expect(range!.toString()).toBe('tBut');
    });

    test('skips the copies of a name that are kept for truncation', () => {
        const row = rowOf('<span data-truncate-content="visible">readme.md</span><span data-truncate-content="overflow">readme.md</span>');
        const ranges = rangesOfMatches([row], 'README');
        expect(ranges).toHaveLength(1);
        expect(ranges[0]!.startContainer.parentElement!.dataset.truncateContent).toBe('visible');
    });

    test('ends a match at the end of a part without spilling into the next', () => {
        const row = rowOf('<span>src</span><span>/index.ts</span>');
        const [range] = rangesOfMatches([row], 'src');
        expect(range!.endContainer.textContent).toBe('src');
        expect(range!.toString()).toBe('src');
    });
});
