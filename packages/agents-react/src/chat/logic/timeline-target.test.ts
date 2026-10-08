import { afterEach, beforeEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseHTML } from 'linkedom';
import { chatHost, setChatHost, type ChatHost, type FileRef } from '../../host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { FileLinkContext, openFileLink } from '../ui/file-links';
import { Markdown, MessageMarkdown } from '../ui/Markdown';
import { readTimelineTarget, withCurrentText } from './timeline-target';
import type { TimelineRow } from './timeline';

const original = chatHost();
const windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window');
const scope = { id: 'original-machine' } as ChatScope;

beforeEach(() => Object.defineProperty(globalThis, 'window', { configurable: true, value: { getSelection: () => null } }));
afterEach(() => {
    setChatHost(original);
    if (windowBefore) {
        Object.defineProperty(globalThis, 'window', windowBefore);
    } else {
        Reflect.deleteProperty(globalThis, 'window');
    }
});

test('the real Markdown link captures its full ref, cwd and scope without aliasing the host ref', () => {
    const ref: FileRef = { path: 'a folder/日本語.ts', line: 12, column: 4, endLine: 16, directory: false };
    let owner: string | null | undefined;
    setChatHost({
        fileLinks: {
            target: (_text, _cwd, scopeId) => {
                owner = scopeId;
                return ref;
            },
            open: () => {}
        }
    });
    const markup = renderToStaticMarkup(
        createElement(
            ChatScopeContext.Provider,
            { value: scope },
            createElement(FileLinkContext.Provider, { value: '/original-cwd' }, createElement(Markdown, { text: '[Source](<a folder/日本語.ts:12:4-16>)' }))
        )
    );
    const { document } = parseHTML(markup);
    const target = readTimelineTarget(document.querySelector('button')!, document.body, []);
    expect(owner).toBe('original-machine');
    expect(target.path).toBe(ref.path);
    expect(target.line).toBe(12);
    expect(target.file).toEqual({ ref, cwd: '/original-cwd', scopeId: 'original-machine' });
    ref.line = 99;
    document.querySelector('button')!.dataset.fileScopeId = 'other-machine';
    expect(target.file?.ref.line).toBe(12);
    expect(target.file?.scopeId).toBe('original-machine');
});

test('standalone Markdown uses an explicit null owner and preserves directory refs', () => {
    setChatHost({ fileLinks: { target: () => ({ path: '/folder/', directory: true }), open: () => {} } });
    const { document } = parseHTML(renderToStaticMarkup(createElement(Markdown, { text: '[Folder](/folder/)' })));
    expect(readTimelineTarget(document.querySelector('button')!, document.body, []).file).toEqual({
        ref: { path: '/folder/', directory: true },
        cwd: null,
        scopeId: null
    });
});

test('mention chips inherit the nearest timeline origin', () => {
    const chips = renderToStaticMarkup(createElement(MessageMarkdown, { text: '@source.ts', mentions: ['source.ts'] }));
    const { document } = parseHTML(
        `<div data-file-cwd="/parent" data-file-scope-id="parent-machine"><div data-file-cwd="/child" data-file-scope-id="child-machine">${chips}</div></div>`
    );
    const element = document.querySelector<HTMLElement>('[data-file-path]')!;
    expect(readTimelineTarget(element.querySelector('span')!, document.body, []).file).toEqual({
        ref: { path: 'source.ts', directory: false },
        cwd: '/child',
        scopeId: 'child-machine'
    });
});

test('directory mention chips keep their directory flag when opened from the menu', () => {
    const chips = renderToStaticMarkup(createElement(MessageMarkdown, { text: '@source/', mentions: ['source/'] }));
    const { document } = parseHTML(`<div data-file-cwd="/repo" data-file-scope-id="machine">${chips}</div>`);
    const element = document.querySelector<HTMLElement>('[data-file-path]')!;
    expect(readTimelineTarget(element, document.body, []).file).toEqual({
        ref: { path: 'source/', directory: true },
        cwd: '/repo',
        scopeId: 'machine'
    });
});

test('legacy path and line attributes still work, and malformed coordinates do not become locations', () => {
    const { document } = parseHTML('<div data-file-path="old.ts" data-file-line="3"><span>Legacy</span></div>');
    const element = document.querySelector('div')!;
    expect(readTimelineTarget(element.firstElementChild as HTMLElement, document.body, []).file?.ref).toEqual({ path: 'old.ts', line: 3, directory: false });
    element.dataset.fileLine = '1.5';
    element.dataset.fileColumn = '-2';
    element.dataset.fileEndLine = '9';
    expect(readTimelineTarget(element, document.body, []).file?.ref).toEqual({ path: 'old.ts', directory: false });
    element.dataset.fileLine = '12';
    element.dataset.fileEndLine = '3';
    expect(readTimelineTarget(element, document.body, []).file?.ref).toEqual({ path: 'old.ts', line: 12, directory: false });
});

test('two-argument file adapters and helper calls remain supported', () => {
    const calls: unknown[] = [];
    const fileLinks: NonNullable<ChatHost['fileLinks']> = {
        target: (_text, _cwd) => ({ path: '/legacy', directory: false }),
        open: (cwd, ref) => {
            calls.push({ cwd, ref });
        }
    };
    setChatHost({ fileLinks });
    const ref = fileLinks.target('/legacy', null)!;
    openFileLink(null, ref);
    expect(calls).toEqual([{ cwd: null, ref }]);
});

test('ordinary timeline targets retain row lookup and current-text copy behavior', () => {
    const item = { id: 'answer', kind: 'assistant' as const, turnId: null, createdAt: 0, text: 'Before', streaming: true };
    const row: TimelineRow = { id: item.id, kind: 'assistant', item };
    const { document } = parseHTML('<div data-item-id="answer"><pre><code>printf copy</code></pre></div>');
    const target = readTimelineTarget(document.querySelector('code')!, document.body, [row]);
    expect(target.row).toEqual(row);
    expect(target.code).toBe('printf copy');
    expect(target.file).toBeNull();
    expect(withCurrentText([row], { answer: { ...item, text: 'After' } })).toEqual([{ ...row, item: { ...item, text: 'After' } }]);
});
