import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { FakeEditorEngine, type FakeEditor } from '@adecore/editor/fake';
import type { ProviderOptions, ServerMessage, TypeHierarchyItem } from '@adecore/lsp';
import { colorOfHex, cssColorOf } from './document-colors.ts';
import { linkPosition } from './document-links.ts';
import { EditorLanguage } from './editor-language.ts';
import type { LanguageHost } from './host-types.ts';
import { firstWord, suggestionOf, type InlineSuggestionSource } from './inline-completion.ts';
import type { Place } from './navigation-history.ts';
import { ProjectLanguage } from './project-language.ts';
import { FakeLanguageService, ManualTimers, type LanguageCall } from './testing.ts';

const uri = 'file:///work/src/page.ts';

async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

const range = (line: number, start: number, end: number) => ({ start: { line, character: start }, end: { line, character: end } });

interface Setup {
    service: FakeLanguageService;
    project: ProjectLanguage;
    editor: FakeEditor;
    language: EditorLanguage;
    timers: ManualTimers;
    visits: Place[];
}

const open: Setup[] = [];

afterEach(() => {
    for (const setup of open.splice(0)) {
        setup.language.dispose();
        setup.project.dispose();
    }
});

async function setup(
    text: string,
    answers: Record<string, ((call: LanguageCall) => unknown) | [(call: LanguageCall) => unknown, ProviderOptions]> = {},
    host: LanguageHost = {}
): Promise<Setup> {
    const service = new FakeLanguageService();
    for (const [method, answer] of Object.entries(answers)) {
        if (Array.isArray(answer)) {
            service.respond(method, answer[0], answer[1]);
        } else {
            service.respond(method, answer);
        }
    }
    const visits: Place[] = [];
    const project = new ProjectLanguage(service, { openPlace: (place) => visits.push(place), ...host });
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text, theme: 'light' });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, editor, uri, 'typescript', timers);
    await language.document.ready;
    await settle();
    const result = { service, project, editor, language, timers, visits };
    open.push(result);
    return result;
}

describe('document links', () => {
    test('reads a line and a column from the fragment of a link', () => {
        expect(linkPosition('file:///a.ts#L12,4')).toEqual({ uri: 'file:///a.ts', position: { line: 11, character: 3 } });
        expect(linkPosition('file:///a.ts#3')).toEqual({ uri: 'file:///a.ts', position: { line: 2, character: 0 } });
        expect(linkPosition('file:///a.ts')).toEqual({ uri: 'file:///a.ts', position: { line: 0, character: 0 } });
    });

    test('follows a link with Mod+click, asking the server for a target it left out', async () => {
        const { editor, visits } = await setup("import './other';", {
            'textDocument/documentLink': () => [{ range: range(0, 8, 15), data: 1 }],
            'documentLink/resolve': [(call) => ({ ...(call.params as object), target: 'file:///work/src/other.ts#L3' }), { resolveProvider: true }]
        });
        expect(editor.click({ position: { line: 0, character: 10 }, mod: true, alt: false, shift: false })).toBe(true);
        await settle();
        expect(visits).toEqual([{ uri: 'file:///work/src/other.ts', position: { line: 2, character: 0 } }]);
        expect(editor.click({ position: { line: 0, character: 2 }, mod: true, alt: false, shift: false })).toBe(false);
    });

    test('opens a web address through the host and draws the link under the pointer while Mod is held', async () => {
        const opened: string[] = [];
        const { editor, language } = await setup(
            '// see https://example.com',
            { 'textDocument/documentLink': () => [{ range: range(0, 7, 26), target: 'https://example.com' }] },
            {
                openExternal: (url) => opened.push(url)
            }
        );
        editor.hover({ line: 0, character: 10 });
        language.definitionLink.setModHeld(true);
        expect(editor.link).toEqual(range(0, 7, 26));
        editor.click({ position: { line: 0, character: 10 }, mod: true, alt: false, shift: false });
        await settle();
        expect(opened).toEqual(['https://example.com']);
    });

    test('drops the links on an edit and asks again once typing rests', async () => {
        let asked = 0;
        const { editor, language, timers } = await setup('a', {
            'textDocument/documentLink': () => [{ range: range(0, 0, 1), target: `file:///x${++asked}` }]
        });
        expect(language.links.all()).toHaveLength(1);
        editor.type('ab');
        expect(language.links.all()).toHaveLength(0);
        timers.advance(500);
        await settle();
        expect(language.links.all()[0]?.target).toBe('file:///x2');
    });
});

describe('document colors', () => {
    test('turns colors of LSP into CSS and back from a color input', () => {
        expect(cssColorOf({ red: 1, green: 0.5, blue: 0, alpha: 0.25 })).toBe('color(srgb 1 0.5 0 / 0.25)');
        expect(colorOfHex('#ff0000')).toEqual({ red: 1, green: 0, blue: 0, alpha: 1 });
        expect(colorOfHex('red')).toBeNull();
    });

    test('draws a swatch before each color beside the inlay hints, and writes the presentation chosen for it', async () => {
        const red = { red: 1, green: 0, blue: 0, alpha: 1 };
        const { editor, language } = await setup('color: #f00;', {
            'textDocument/documentColor': () => [{ range: range(0, 7, 11), color: red }],
            'textDocument/colorPresentation': () => [{ label: '#f00' }, { label: 'rgb(255 0 0)' }]
        });
        expect(editor.inlayHints).toEqual([
            { id: 'color-0', position: { line: 0, character: 7 }, label: 'Color #ff0000', swatch: 'color(srgb 1 0 0 / 1)', paddingRight: true }
        ]);
        editor.setInlayHints([{ position: { line: 0, character: 0 }, label: 'hint' }]);
        expect(editor.inlayHints).toHaveLength(2);
        expect(editor.clickInlay({ id: 'color-0' })).toBe(true);
        await settle();
        const pick = language.popups.slot('pick').get();
        expect(pick?.groups[0]?.rows.map((row) => row.label)).toEqual(['#f00', 'rgb(255 0 0)']);
        language.pick.choose('1');
        await settle();
        expect(editor.getText()).toBe('color: rgb(255 0 0);');
    });

    test('draws nothing once the host turns the swatches off', async () => {
        const { editor, language } = await setup('#000', {
            'textDocument/documentColor': () => [{ range: range(0, 0, 4), color: { red: 0, green: 0, blue: 0, alpha: 1 } }]
        });
        language.colors.configure({ enabled: false });
        expect(editor.inlayHints).toEqual([]);
    });
});

describe('linked editing', () => {
    test('copies a change of one linked range into the others, until an edit falls outside them', async () => {
        const { editor, timers } = await setup('<div></div>', { 'textDocument/linkedEditingRange': () => ({ ranges: [range(0, 1, 4), range(0, 7, 10)] }) });
        editor.setCaret({ line: 0, character: 4 });
        await settle();
        timers.advance(100);
        await settle();
        editor.type('<divx></div>');
        await settle();
        expect(editor.getText()).toBe('<divx></divx>');
        editor.type('<divx> </divx>');
        await settle();
        editor.type('<divxy> </divx>');
        await settle();
        expect(editor.getText()).toBe('<divxy> </divx>');
    });

    test('stops at a change the word pattern of the server refuses', async () => {
        const { editor, timers } = await setup('<a></a>', {
            'textDocument/linkedEditingRange': () => ({ ranges: [range(0, 1, 2), range(0, 5, 6)], wordPattern: '[a-z]+' })
        });
        editor.setCaret({ line: 0, character: 2 });
        await settle();
        timers.advance(100);
        await settle();
        editor.type('<a1></a>');
        await settle();
        expect(editor.getText()).toBe('<a1></a>');
    });
});

describe('type hierarchy', () => {
    const type = (name: string, line = 0): TypeHierarchyItem => ({ name, kind: 5, uri, range: range(line, 0, 1), selectionRange: range(line, 0, 1) });

    test('opens on the supertypes, switches to the subtypes and back to calls', async () => {
        const { language } = await setup('class B extends A {}', {
            'textDocument/prepareTypeHierarchy': () => [type('B')],
            'typeHierarchy/supertypes': () => [type('A')],
            'typeHierarchy/subtypes': () => [type('C'), type('D')],
            'textDocument/prepareCallHierarchy': () => []
        });
        await language.callHierarchy.open(undefined, 'supertypes');
        await settle();
        const names = (): string[] => (language.popups.slot('callHierarchy').get()?.rows ?? []).flatMap((row) => (row.kind === 'node' ? [row.item.name] : []));
        expect(language.popups.slot('callHierarchy').get()?.direction).toBe('supertypes');
        expect(names()).toEqual(['B', 'A']);
        language.callHierarchy.setDirection('subtypes');
        await settle();
        expect(names()).toEqual(['B', 'C', 'D']);
    });

    test('says when no server answers the type hierarchy', async () => {
        const notices: string[] = [];
        const { language } = await setup('x', {}, { notify: (notice) => notices.push(notice.title) });
        expect(language.callHierarchy.typesSupported).toBe(false);
        await language.callHierarchy.open(undefined, 'subtypes');
        expect(notices).toEqual(['Type hierarchy unavailable in this file']);
    });
});

describe('inline completion', () => {
    test('takes a suggestion only where it continues what is typed', () => {
        const caret = { line: 0, character: 3 };
        const textOf = () => 'con';
        expect(suggestionOf({ insertText: 'console', range: range(0, 0, 3) }, caret, textOf)?.rest).toBe('sole');
        expect(suggestionOf({ insertText: 'window', range: range(0, 0, 3) }, caret, textOf)).toBeNull();
        expect(suggestionOf({ insertText: { kind: 'snippet', value: 'log(${1:x})' } }, caret, () => '')?.rest).toBe('log(x)');
    });

    test('is off by default, and once on draws a suggestion after typing rests that Tab takes', async () => {
        const { editor, language, timers, service } = await setup('', {
            'textDocument/inlineCompletion': () => [{ insertText: 'console.log()', range: range(0, 0, 3) }]
        });
        editor.type('con');
        timers.advance(300);
        await settle();
        expect(service.calls.some((call) => call.method === 'textDocument/inlineCompletion')).toBe(false);
        language.inlineCompletion.configure({ enabled: true });
        editor.type('cons');
        editor.type('con');
        timers.advance(300);
        await settle();
        expect(editor.ghost).toEqual({ position: { line: 0, character: 3 }, text: 'sole.log()' });
        expect(editor.press({ key: 'Tab' })).toBe(true);
        expect(editor.getText()).toBe('console.log()');
        expect(editor.ghost).toBeNull();
    });

    test('puts the suggestion away on Escape', async () => {
        const { editor, language, timers } = await setup('', { 'textDocument/inlineCompletion': () => ({ items: [{ insertText: 'abc' }] }) });
        language.inlineCompletion.configure({ enabled: true });
        editor.type('');
        language.inlineCompletion.trigger();
        await settle();
        expect(editor.ghost?.text).toBe('abc');
        editor.press({ key: 'Escape' });
        expect(editor.ghost).toBeNull();
        timers.advance(1000);
    });
});

describe('firstWord', () => {
    test('takes the whitespace before a word with it, and a run of punctuation as one word', () => {
        expect(firstWord('  const x = 1;')).toBe('  const');
        expect(firstWord(' = 1;')).toBe(' =');
        expect(firstWord('\n    return a;')).toBe('\n    return');
        expect(firstWord('')).toBe('');
    });
});

describe('inline completion with a source of the app', () => {
    const sourceOf = (text: string, calls: number[] = []): InlineSuggestionSource => ({
        enabled: true,
        automatic: false,
        suggest: async ({ caret, triggerKind }) => {
            calls.push(triggerKind);
            return [{ text, range: { start: caret, end: caret }, rest: text, words: true }];
        }
    });

    test('a person asking gets the source of the highest priority, and the servers are not asked', async () => {
        const { editor, language, service } = await setup('', { 'textDocument/inlineCompletion': () => [{ insertText: 'server' }] });
        language.inlineCompletion.configure({ enabled: true });
        language.inlineCompletion.addSource(sourceOf('mine'), 10);
        expect(language.inlineCompletion.trigger()).toBe(true);
        await settle();
        expect(editor.ghost?.text).toBe('mine');
        expect(service.calls.some((call) => call.method === 'textDocument/inlineCompletion')).toBe(false);
    });

    test('is not asked while typing stops, and gives the key back when no source is enabled', async () => {
        const calls: number[] = [];
        const { editor, language, timers } = await setup('');
        language.inlineCompletion.addSource(sourceOf('mine', calls), 10);
        editor.type('a');
        timers.advance(300);
        await settle();
        expect(calls).toEqual([]);
        const off = await setup('');
        expect(off.language.inlineCompletion.trigger()).toBe(false);
    });

    test('one Tab takes the suggestion, and a typed character puts it away without the source clearing the other', async () => {
        const { editor, language } = await setup('');
        language.inlineCompletion.addSource(sourceOf('mine'), 10);
        language.inlineCompletion.trigger();
        await settle();
        expect(editor.press({ key: 'Tab' })).toBe(true);
        expect(editor.getText()).toBe('mine');
        expect(editor.getCaret()).toEqual({ line: 0, character: 4 });
        expect(editor.ghost).toBeNull();
    });

    test('takes a word of a suggestion that allows it and keeps the rest drawn after the caret', async () => {
        const { editor, language } = await setup('');
        language.inlineCompletion.addSource(sourceOf('return pool;'), 10);
        language.inlineCompletion.trigger();
        await settle();
        expect(language.inlineCompletion.acceptWord()).toBe(true);
        expect(editor.getText()).toBe('return');
        expect(editor.ghost).toMatchObject({ position: { line: 0, character: 6 }, text: ' pool;' });
    });

    test('Escape ends a request a person asked for that is still out', async () => {
        const { editor, language } = await setup('');
        let aborted = false;
        language.inlineCompletion.addSource(
            {
                enabled: true,
                automatic: false,
                suggest: ({ signal }) =>
                    new Promise((resolve) => {
                        signal.addEventListener('abort', () => {
                            aborted = true;
                            resolve([]);
                        });
                    })
            },
            10
        );
        language.inlineCompletion.trigger();
        expect(editor.press({ key: 'Escape' })).toBe(true);
        expect(aborted).toBe(true);
    });

    /* A source whose request stays out until the test answers it. */
    function pendingSource() {
        const state = {
            aborted: false,
            enabled: true,
            answer: (): void => undefined
        };
        const source: InlineSuggestionSource = {
            get enabled() {
                return state.enabled;
            },
            automatic: false,
            suggest: ({ caret, signal }) =>
                new Promise((resolve) => {
                    signal.addEventListener('abort', () => {
                        state.aborted = true;
                    });
                    state.answer = () => resolve([{ text: 'late', range: { start: caret, end: caret }, rest: 'late' }]);
                })
        };

        return { state, source };
    }

    test('turning the language servers off ends a request of theirs that is still out', async () => {
        let answer: () => void = () => undefined;
        const { editor, language, service } = await setup('', {
            'textDocument/inlineCompletion': () =>
                new Promise((resolve) => {
                    answer = () => resolve([{ insertText: 'late' }]);
                })
        });
        language.inlineCompletion.configure({ enabled: true });
        language.inlineCompletion.trigger();
        await settle();
        const signal = service.calls.find((call) => call.method === 'textDocument/inlineCompletion')?.options.signal;
        expect(signal?.aborted).toBe(false);
        language.inlineCompletion.configure({ enabled: false });
        expect(signal?.aborted).toBe(true);
        answer();
        await settle();
        expect(editor.ghost).toBeNull();
    });

    test('removing a source ends a request of its that is still out', async () => {
        const { editor, language } = await setup('');
        const { state, source } = pendingSource();
        const remove = language.inlineCompletion.addSource(source, 10);
        language.inlineCompletion.trigger();
        expect(state.aborted).toBe(false);
        remove();
        expect(state.aborted).toBe(true);
        state.answer();
        await settle();
        expect(editor.ghost).toBeNull();
        expect(language.inlineCompletion.current).toBeNull();
    });

    test('draws no answer of a source that was turned off by the app while its request was out', async () => {
        const { editor, language } = await setup('');
        const { state, source } = pendingSource();
        language.inlineCompletion.addSource(source, 10);
        language.inlineCompletion.trigger();
        state.enabled = false;
        state.answer();
        await settle();
        expect(editor.ghost).toBeNull();
        expect(language.inlineCompletion.current).toBeNull();
    });

    /* A source that draws a suggestion at once and counts how often it hears that the suggestion is gone. */
    function drawingSource(text: string, options: { automatic?: boolean } = {}) {
        const state = { cleared: 0, asked: 0, enabled: true };
        const source: InlineSuggestionSource = {
            get enabled() {
                return state.enabled;
            },
            automatic: options.automatic ?? false,
            suggest: async ({ caret }) => {
                state.asked++;

                return [{ text, range: { start: caret, end: caret }, rest: text, words: true }];
            },
            cleared: () => void state.cleared++
        };

        return { state, source };
    }

    test('a source whose suggestion is gone hears so once and no longer counts as holding a request', async () => {
        const { editor, language } = await setup('');
        const mine = drawingSource('mine');
        const other = pendingSource();
        const removeMine = language.inlineCompletion.addSource(mine.source, 10);
        language.inlineCompletion.addSource(other.source, 5);
        language.inlineCompletion.trigger();
        await settle();
        editor.press({ key: 'Escape' });

        expect(mine.state.cleared).toBe(1);

        void language.inlineCompletion.triggerSource(other.source);
        removeMine();

        expect(other.state.aborted).toBe(false);
        expect(mine.state.cleared).toBe(1);

        editor.type('a');

        expect(mine.state.cleared).toBe(1);
    });

    test('a source whose suggestion was taken word by word to the end is let go of too', async () => {
        const { language } = await setup('');
        const mine = drawingSource('word');
        const other = pendingSource();
        const removeMine = language.inlineCompletion.addSource(mine.source, 10);
        language.inlineCompletion.addSource(other.source, 5);
        language.inlineCompletion.trigger();
        await settle();

        expect(language.inlineCompletion.acceptWord()).toBe(true);
        expect(language.inlineCompletion.current).toBeNull();
        expect(language.inlineCompletion.holds(mine.source)).toBe(false);

        void language.inlineCompletion.triggerSource(other.source);
        removeMine();

        expect(other.state.aborted).toBe(false);
        expect(mine.state.cleared).toBe(1);
    });

    test('removing a source drops the ask that typing queued for it', async () => {
        const { editor, language, timers } = await setup('');
        const mine = drawingSource('mine', { automatic: true });
        const remove = language.inlineCompletion.addSource(mine.source, 10);
        const before = timers.size;
        editor.type('a');

        expect(timers.size).toBeGreaterThan(before);

        const queued = timers.size;
        remove();

        expect(timers.size).toBe(queued - 1);

        timers.advance(300);
        await settle();

        expect(mine.state.asked).toBe(0);
        expect(editor.ghost).toBeNull();
    });

    test('a source that is no longer registered is not asked', async () => {
        const { editor, language } = await setup('');
        const mine = drawingSource('mine');
        language.inlineCompletion.addSource(mine.source, 10)();

        await language.inlineCompletion.triggerSource(mine.source);

        expect(mine.state.asked).toBe(0);
        expect(editor.ghost).toBeNull();
    });

    test('a suggestion that came by itself gives Tab to an open completion list', async () => {
        const { editor, language, timers } = await setup('', { 'textDocument/inlineCompletion': () => [{ insertText: 'abc' }] });
        language.inlineCompletion.configure({ enabled: true });
        editor.type('a');
        timers.advance(300);
        await settle();
        expect(editor.ghost?.text).toBe('abc');
        language.popups.slot('completion').set({} as never);
        editor.press({ key: 'Tab' });
        expect(editor.getText()).toBe('a');
    });
});

describe('features of the app', () => {
    test('are built after the shared ones and come back as app', async () => {
        const service = new FakeLanguageService();
        const project = new ProjectLanguage(service);
        const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: '', theme: 'light' });
        const language = new EditorLanguage(project, editor, uri, 'typescript', new ManualTimers(), {
            features: (built) => ({ sawHover: built.hover !== undefined, uri: built.uri })
        });
        expect(language.app).toEqual({ sawHover: true, uri });
        language.dispose();
        project.dispose();
    });

    test('a key for a served document never reaches a document no server serves', async () => {
        const service = new FakeLanguageService();
        const project = new ProjectLanguage(service);
        const pressed: string[] = [];
        for (const serve of [true, false]) {
            const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: '', theme: 'light' });
            const language = new EditorLanguage(project, editor, `${uri}?${serve}`, 'typescript', new ManualTimers(), { serve });
            language.onServedKey((event) => {
                pressed.push(`${serve}:${event.key}`);
                return true;
            });
            editor.press({ key: 'F9' });
            language.dispose();
        }
        project.dispose();
        expect(pressed).toEqual(['true:F9']);
    });

    test('a service is built from the project and reads the text of the editor that holds a document', async () => {
        const base = new FakeLanguageService();
        let text: string | undefined;
        const project = new ProjectLanguage((owner) => {
            text = owner.openTextOf(uri);
            return base;
        });
        expect(text).toBeUndefined();
        const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: 'let a;', theme: 'light' });
        const handle = project.acquire(uri, 'typescript', editor);
        expect(project.openTextOf(uri)).toBe('let a;');
        handle.release();
        expect(project.openTextOf(uri)).toBeUndefined();
        project.dispose();
    });
});

describe('saving', () => {
    test('tells the servers a save is coming and applies the edits they want first', async () => {
        const { editor, language, service } = await setup('import b;\nimport a;', {
            'textDocument/willSaveWaitUntil': () => [
                { range: range(0, 0, 9), newText: 'import a;' },
                { range: range(1, 0, 9), newText: 'import b;' }
            ]
        });
        await language.prepareSave();
        expect(service.calls.map((call) => call.method)).toContain('textDocument/willSave');
        expect(editor.getText()).toBe('import a;\nimport b;');
    });

    test('passes over a server that does not answer within a second', async () => {
        const { editor, language, timers } = await setup('x', {
            'textDocument/willSaveWaitUntil': (call) =>
                new Promise((_resolve, reject) => call.options.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
        });
        const saving = language.prepareSave();
        await settle();
        timers.advance(1000);
        await saving;
        expect(editor.getText()).toBe('x');
    });
});

describe('saving a document nothing serves or that is gone', () => {
    test('sends no willSave for a document no server serves', async () => {
        const service = new FakeLanguageService();
        service.respond('textDocument/willSaveWaitUntil', () => [{ range: range(0, 0, 1), newText: 'y' }]);
        const project = new ProjectLanguage(service);
        const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: 'x', theme: 'light' });
        const language = new EditorLanguage(project, editor, uri, 'plaintext', new ManualTimers(), { serve: false });
        open.push({ service, project, editor, language, timers: new ManualTimers(), visits: [] });
        await language.prepareSave();

        expect(service.calls.map((call) => call.method)).not.toContain('textDocument/willSave');
        expect(service.calls.map((call) => call.method)).not.toContain('textDocument/willSaveWaitUntil');
        expect(editor.getText()).toBe('x');
    });

    test('applies no edit that arrives after the editor was disposed', async () => {
        let answer: (edits: unknown) => void = () => undefined;
        const { editor, language } = await setup('x', {
            'textDocument/willSaveWaitUntil': () => new Promise((resolve) => (answer = resolve))
        });
        const saving = language.prepareSave();
        await settle();
        language.dispose();
        answer([{ range: range(0, 0, 1), newText: 'y' }]);
        await saving;

        expect(editor.getText()).toBe('x');
    });
});

describe('formatting a selection', () => {
    test('asks for every selection at once from a server that formats several ranges', async () => {
        const { editor, language, service } = await setup('a\nb\nc', {
            'textDocument/rangeFormatting': () => [],
            'textDocument/rangesFormatting': () => [{ range: range(2, 0, 1), newText: 'C' }]
        });
        editor.setSelections([range(0, 0, 1), range(2, 0, 1)]);
        await language.codeActions.formatSelection();
        expect(service.calls.filter((call) => call.method.endsWith('Formatting')).map((call) => call.method)).toEqual(['textDocument/rangesFormatting']);
        expect(editor.getText()).toBe('a\nb\nC');
    });

    test('asks range by range otherwise', async () => {
        const { editor, language, service } = await setup('a\nb', { 'textDocument/rangeFormatting': () => [] });
        editor.setSelections([range(0, 0, 1), range(1, 0, 1)]);
        await language.codeActions.formatSelection();
        expect(service.calls.filter((call) => call.method === 'textDocument/rangeFormatting')).toHaveLength(2);
    });
});

describe('the project', () => {
    test('shows a document a server asks for, a web address through the host', async () => {
        const opened: string[] = [];
        const { service, visits } = await setup('x', {}, { openExternal: (url) => opened.push(url) });
        expect(await service.show({ uri: 'file:///work/a.ts', selection: range(4, 2, 2) })).toBe(true);
        expect(visits).toEqual([{ uri: 'file:///work/a.ts', position: { line: 4, character: 2 } }]);
        expect(await service.show({ uri: 'https://example.com' })).toBe(true);
        expect(opened).toEqual(['https://example.com']);
    });

    test('hands the messages of the servers to the host', async () => {
        const messages: ServerMessage[] = [];
        const { service } = await setup('x', {}, { onServerMessage: (message) => messages.push(message) });
        service.message({ kind: 'show', type: 2, message: 'Careful' });
        expect(messages).toEqual([{ kind: 'show', type: 2, message: 'Careful' }]);
    });

    test('reads a document of a scheme a server serves', async () => {
        const { project } = await setup('x', { 'workspace/textDocumentContent': () => ({ text: 'class A {}' }) });
        expect(await project.readText('jdt://contents/A.class')).toBe('class A {}');
    });

    test('lists the problems of the workspace, keeping a file the server reports unchanged', async () => {
        const diagnostic = { range: range(0, 0, 1), message: 'Broken', severity: 1 as const };
        let round = 0;
        const { project, service } = await setup('x', {
            'workspace/diagnostic': () =>
                ++round === 1
                    ? { items: [{ kind: 'full', uri: 'file:///work/b.ts', version: null, resultId: '1', items: [diagnostic] }] }
                    : { items: [{ kind: 'unchanged', uri: 'file:///work/b.ts', version: null, resultId: '1' }] }
        });
        expect(await project.pullWorkspaceProblems(uri)).toBe(true);
        expect(await project.pullWorkspaceProblems(uri)).toBe(true);
        expect(project.problems.getSnapshot().map((file) => file.path)).toEqual(['/work/b.ts']);
        const second = service.calls.filter((call) => call.method === 'workspace/diagnostic')[1]!;
        expect(second.params).toEqual({ previousResultIds: [{ uri: 'file:///work/b.ts', value: '1' }] });
    });
});
