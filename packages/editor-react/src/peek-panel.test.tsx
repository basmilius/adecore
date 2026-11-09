import './test-setup.ts';
import { expect, test } from 'bun:test';
import { createPage } from '@adecore/editor/testing';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { EditorLanguage } from './editor-language.ts';
import { PeekPanel } from './PeekPanel.tsx';
import type { PeekView } from './popups.ts';
import { RenderingContext } from './rendering-context.ts';

async function inPage(run: (page: ReturnType<typeof createPage>, root: ReturnType<typeof createRoot>) => Promise<void>): Promise<void> {
    const page = createPage();
    // The page has no layout, so nothing scrolls.
    (page.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined;
    const names = ['window', 'document', 'Element', 'HTMLElement', 'Node', 'getComputedStyle'] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

    for (const name of names) {
        Object.defineProperty(globalThis, name, {
            value: name === 'document' ? page.document : (page.window as never as Record<string, unknown>)[name === 'window' ? 'window' : name],
            configurable: true
        });
    }

    const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousAct = globals.IS_REACT_ACT_ENVIRONMENT;
    globals.IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(page.host);

    try {
        await run(page, root);
    } finally {
        await act(async () => root.unmount());
        globals.IS_REACT_ACT_ENVIRONMENT = previousAct;

        for (const [index, name] of names.entries()) {
            const descriptor = previous[index];

            if (descriptor === undefined) {
                Reflect.deleteProperty(globalThis, name);
            } else {
                Object.defineProperty(globalThis, name, descriptor);
            }
        }
    }
}

const language = {
    project: { folder: '/work', panelBodyHeight: 200, onPanelBodyChange: () => () => undefined, resizePanelBody: () => undefined },
    peek: { toggleFile: () => undefined, go: () => undefined, select: () => undefined, close: () => undefined }
} as unknown as EditorLanguage;

const place = (id: string, line: number, text: string, name: { start: number; end: number } | null) => ({
    id,
    line,
    text,
    name,
    location: { uri: 'file:///work/src/a.ts', range: { start: { line, character: 0 }, end: { line, character: 3 } } }
});

/* What the highlighter of shiki puts out for code: one span per line, tokens inside. */
function highlighted(code: string): string {
    const lines = code.split('\n').map((line) => `<span class="line"><span style="color:#d73a49">${line}</span></span>`);

    return `<pre class="shiki"><code>${lines.join('\n')}</code></pre>`;
}

test('the places are drawn in the colors of their syntax with the name marked, and in plain text while there are none', async () => {
    await inPage(async (page, root) => {
        const container = page.document.createElement('div');
        page.document.body.append(container);
        const view: PeekView = {
            kind: 'references',
            container,
            files: [{ uri: 'file:///work/src/a.ts', places: [place('0:0', 1, 'run(a);', { start: 0, end: 3 }), place('0:1', 4, '', null)] }],
            active: '0:0',
            collapsed: [],
            count: 2,
            preview: null
        };
        const asked: Array<[string, string, string]> = [];
        const rendering = {
            theme: 'light',
            highlight: async (code: string, languageId: string, theme: string) => {
                asked.push([code, languageId, theme]);

                return highlighted(code);
            }
        };

        await act(async () => root.render(createElement(PeekPanel, { language, view })));
        const plain = [...container.querySelectorAll('button[data-active]')].map((button) => button.textContent);

        expect(plain).toEqual(['run(a);', ':5']);
        expect(container.querySelector('button[data-active] span[style]')).toBeNull();

        await act(async () => root.render(createElement(RenderingContext.Provider, { value: rendering }, createElement(PeekPanel, { language, view }))));
        await act(async () => undefined);

        const buttons = [...container.querySelectorAll('button[data-active]')];

        expect(asked).toEqual([['run(a);\n', 'typescript', 'light']]);
        expect(buttons[0]!.querySelector('span[style*="color"]')?.textContent).toBe('run(a);');
        expect(buttons[0]!.textContent).toBe('run(a);');
        expect(buttons[0]!.querySelector('[aria-hidden]')?.getAttribute('style')).toBe('left:0ch;width:3ch');
        expect(buttons[1]!.textContent).toBe(':5');
    });
});

test('keeps the plain line when the highlighter fails or answers another number of lines', async () => {
    await inPage(async (page, root) => {
        const container = page.document.createElement('div');
        page.document.body.append(container);
        const view: PeekView = {
            kind: 'references',
            container,
            files: [{ uri: 'file:///work/src/a.ts', places: [place('0:0', 1, 'run(a);', null)] }],
            active: '0:0',
            collapsed: [],
            count: 1,
            preview: null
        };

        for (const highlight of [async () => Promise.reject(new Error('no grammar')), async () => highlighted('one\ntwo')]) {
            await act(async () =>
                root.render(
                    createElement(
                        RenderingContext.Provider,
                        { value: { theme: 'light', highlight }, key: String(highlight) },
                        createElement(PeekPanel, { language, view })
                    )
                )
            );
            await act(async () => undefined);

            expect(container.querySelector('button[data-active]')!.textContent).toBe('run(a);');
            expect(container.querySelector('button[data-active] span[style]')).toBeNull();
        }
    });
});
