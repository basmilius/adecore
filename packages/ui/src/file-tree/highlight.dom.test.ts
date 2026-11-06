import { describe, expect, test } from 'bun:test';
import { rangesOfMatches } from './highlight.ts';

describe('marking the matches in the rows of a tree', () => {
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
