import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compileUi } from '@adecore/intelligent-ui';
import { UiReply } from './UiReply';
import { uiReplyParts } from './reply-parts';

const context = { scopeId: 'scope', chatId: 'chat', itemId: 'item', phase: 'final' as const, answer: null };

test('interleaves prose and several blocks while rejecting overlapping or invalid ranges', () => {
    const text = 'Before\n```ruimte-ui\n<Summary>One</Summary>\n```\nMiddle\n```ruimte-ui\n<Summary>Two</Summary>\n```\nAfter';
    const blocks = compileUi(text, { id: 'item', final: true });
    const parts = uiReplyParts(text, [blocks[1], blocks[0], { ...blocks[0], start: -1 }, { ...blocks[1], end: text.length + 1 }]);
    expect(parts.map((part) => part.kind)).toEqual(['text', 'ui', 'text', 'ui', 'text']);
    expect(parts.filter((part) => part.kind === 'text').map((part) => part.text)).toEqual(['Before\n', 'Middle\n', 'After']);
});

test('a growing unfinished block does not echo its uncompiled raw tail as prose', () => {
    const text = 'Before\n```ruimte-ui\n<Summary>Open';
    const blocks = compileUi(text, { id: 'item' });
    const parts = uiReplyParts(text + ' grows', blocks, true);
    expect(parts.map((part) => part.kind)).toEqual(['text', 'ui']);
});

test('renders compiled nodes in the actual reply composition and falls back for a future catalog', () => {
    const text = '```ruimte-ui\n<Summary>Result</Summary><Stats><Stat label="Passed" value={3} /></Stats>\n```';
    const blocks = compileUi(text, { id: 'item', final: true });
    const markup = renderToStaticMarkup(createElement(UiReply, { text, blocks, context }));
    expect(markup).toContain('Result');
    expect(markup).toContain('Passed');
    expect(markup).not.toContain('ruimte-ui');
    const future = [{ ...blocks[0], catalogVersion: 999, fallback: 'Future fallback' }];
    expect(renderToStaticMarkup(createElement(UiReply, { text, blocks: future, context }))).toContain('Future fallback');
});
