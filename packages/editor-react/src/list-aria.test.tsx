import './test-setup.ts';
import { expect, test } from 'bun:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { FakeEditor } from '@adecore/editor/fake';
import { createPage } from '@adecore/editor/testing';
import { CompletionPopup } from './CompletionPopup.tsx';
import type { EditorLanguage } from './editor-language.ts';
import { PickPopup } from './PickPopup.tsx';
import type { CompletionView, PickView } from './popups.ts';

async function inPage(run: (page: ReturnType<typeof createPage>, root: ReturnType<typeof createRoot>) => Promise<void>): Promise<void> {
    const page = createPage();
    // The page has no layout, so nothing scrolls.
    (page.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined;
    const names = ['window', 'document'] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, 'window', { value: page.window, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: page.document, configurable: true });
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

const rect = { left: 0, top: 0, right: 8, bottom: 16 };
const row = (label: string) => ({ label, kind: undefined, detail: '', description: '', matches: [], deprecated: false });

test('the suggestions list is what the input points at, and the active option follows', async () => {
    await inPage(async (page, root) => {
        const editor = new FakeEditor(page.host, { text: 'fo' } as never);
        const language = { editor, shortcuts: { triggerCompletion: null }, completion: { accept: () => Promise.resolve() } } as unknown as EditorLanguage;

        const view = (active: number): CompletionView => ({
            anchor: { line: 0, character: 0 },
            rows: [row('foo'), row('food'), row('fool')],
            active,
            detailsOpen: false,
            docs: null,
            server: 'ts',
            highlightLanguage: 'typescript'
        });

        await act(async () => root.render(createElement(CompletionPopup, { language, view: view(1), rect })));
        const list = page.document.querySelector('[role="listbox"]')!;
        const options = [...list.querySelectorAll('[role="option"]')];

        expect(editor.inputPopup).toEqual({ controls: list.id, activeDescendant: options[1]!.id });
        expect(new Set(options.map((option) => option.id)).size).toBe(3);

        await act(async () => root.render(createElement(CompletionPopup, { language, view: view(2), rect })));

        expect(editor.inputPopup!.activeDescendant).toBe(options[2]!.id);

        await act(async () => root.render(createElement('div')));

        expect(editor.inputPopup).toBeNull();
    });
});

test('a pick list is what the input points at while it is open', async () => {
    await inPage(async (page, root) => {
        const editor = new FakeEditor(page.host, { text: 'fo' } as never);
        const language = { editor, pick: { choose: () => undefined } } as unknown as EditorLanguage;

        const view: PickView = {
            anchor: { line: 0, character: 0 },
            title: null,
            preview: null,
            query: null,
            chosen: [],
            active: 'b',
            groups: [
                { title: 'One', rows: [{ id: 'a', label: 'A', detail: '' }] },
                { title: 'Two', rows: [{ id: 'b', label: 'B', detail: '' }] }
            ]
        };

        await act(async () => root.render(createElement(PickPopup, { language, view, rect })));
        const list = page.document.querySelector('[role="listbox"]')!;
        const options = [...list.querySelectorAll('[role="option"]')];

        expect(editor.inputPopup).toEqual({ controls: list.id, activeDescendant: options[1]!.id });
        expect(options[0]!.id).not.toBe(options[1]!.id);

        await act(async () => root.render(createElement('div')));

        expect(editor.inputPopup).toBeNull();
    });
});

test('a filtering pick list shows its query, marks the match and the chosen rows, and plain preview lines', async () => {
    await inPage(async (page, root) => {
        const editor = new FakeEditor(page.host, { text: 'fo' } as never);
        const pressed: unknown[] = [];
        const language = { editor, pick: { choose: (...args: unknown[]) => pressed.push(args) } } as unknown as EditorLanguage;

        const view: PickView = {
            anchor: { line: 0, character: 0 },
            title: 'Choose',
            preview: { removed: [], added: ['one', 'two'], note: null, kind: 'text' },
            query: 'et',
            chosen: ['a', 'b'],
            active: 'b',
            groups: [
                {
                    title: null,
                    rows: [
                        { id: 'a', label: 'Beta', detail: '' },
                        { id: 'b', label: 'Zeta', detail: '' }
                    ]
                }
            ]
        };

        await act(async () => root.render(createElement(PickPopup, { language, view, rect })));
        const options = [...page.document.querySelectorAll('[role="option"]')];

        expect(page.document.body.textContent).toContain('et');
        expect([...page.document.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['et', 'et']);
        expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'true']);
        expect(options.map((option) => option.getAttribute('data-chosen'))).toEqual(['true', 'true']);
        expect(page.document.body.textContent).toContain('one');
        expect(page.document.body.textContent).not.toContain('+');

        await act(async () => {
            options[0]!.dispatchEvent(Object.assign(new page.window.Event('click', { bubbles: true }), { metaKey: true }));
        });

        expect(pressed).toEqual([['a', { toggle: true, range: undefined }]]);
    });
});

test('a pick list with mnemonics draws them in a column of their own, and an option is still named by its label', async () => {
    await inPage(async (page, root) => {
        const editor = new FakeEditor(page.host, { text: 'fo' } as never);
        const language = { editor, pick: { choose: () => undefined } } as unknown as EditorLanguage;

        const view: PickView = {
            anchor: { line: 0, character: 0 },
            title: 'Surround With',
            preview: null,
            query: null,
            chosen: [],
            active: 'a',
            groups: [
                {
                    title: null,
                    rows: [
                        { id: 'a', label: 'if', detail: '', mnemonic: '1' },
                        { id: 'b', label: 'while', detail: '' }
                    ]
                }
            ]
        };

        await act(async () => root.render(createElement(PickPopup, { language, view, rect })));
        const options = [...page.document.querySelectorAll('[role="option"]')];

        expect(options.map((option) => option.getAttribute('aria-keyshortcuts'))).toEqual(['1', null]);
        expect(options.map((option) => option.firstElementChild?.textContent)).toEqual(['1', '']);
        expect(options.map((option) => option.firstElementChild?.getAttribute('aria-hidden'))).toEqual(['true', 'true']);
        expect(options.map((option) => option.children[1]?.textContent)).toEqual(['if', 'while']);
    });
});
