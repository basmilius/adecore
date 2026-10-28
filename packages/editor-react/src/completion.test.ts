import './test-setup.ts';
import { expect, spyOn, test } from 'bun:test';
import { FakeEditorEngine } from '@adecore/editor/fake';
import { StaleResultError, type CompletionItem } from '@adecore/lsp';
import * as model from './completion-model.ts';
import { EditorLanguage } from './editor-language.ts';
import type { EditorNotification } from './host-types.ts';
import { ProjectLanguage } from './project-language.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

const uri = 'file:///work/src/example.ts';

// The fake language service has no I/O; one event-loop turn drains its promise chains.
async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
}

async function open(text: string, items: readonly CompletionItem[]) {
    const service = new FakeLanguageService();
    service.respond('textDocument/completion', () => items);
    const notifications: EditorNotification[] = [];
    const project = new ProjectLanguage(service, { notify: (notification) => notifications.push(notification) });
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text, theme: 'light' });
    editor.moveCaret({ line: 0, character: text.length });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, editor, uri, 'typescript', timers);
    await language.document.ready;

    const dispose = (): void => {
        language.dispose();
        project.dispose();
    };

    return { service, project, editor, timers, language, notifications, dispose };
}

test('a failed accept is told to the person and never rejects', async () => {
    const { editor, timers, language, notifications, dispose } = await open('pri', [{ label: 'print' }, { label: 'private' }]);
    language.completion.invoke();
    timers.advance(1);
    await settle();

    expect(language.completion.isOpen).toBe(true);

    const applyEdits = spyOn(editor, 'applyEdits').mockImplementation(() => {
        throw new Error('The engine broke');
    });

    await expect(language.completion.accept(false)).resolves.toBeUndefined();
    expect(notifications.map((notification) => notification.title)).toEqual(['Could not insert suggestion: The engine broke']);

    applyEdits.mockRestore();
    dispose();
});

test('a typed character ranks the list once, though the caret and the text both report it', async () => {
    const { editor, timers, language, dispose } = await open('p', [{ label: 'print' }, { label: 'private' }, { label: 'parse' }]);
    language.completion.invoke();
    timers.advance(1);
    await settle();
    const rank = spyOn(model, 'rankCompletions');
    editor.type('pr');

    expect(rank).toHaveBeenCalledTimes(1);

    editor.type('pri');

    expect(rank).toHaveBeenCalledTimes(2);

    rank.mockRestore();
    dispose();
});

test('a pause in typing over a complete list asks for nothing', async () => {
    const { service, editor, timers, language, dispose } = await open('p', [{ label: 'print' }, { label: 'private' }]);
    language.completion.invoke();
    timers.advance(1);
    await settle();
    editor.type('pr');
    timers.advance(1_000);
    await settle();

    expect(service.calls.filter((call) => call.method === 'textDocument/completion')).toHaveLength(1);
    expect(language.completion.isOpen).toBe(true);

    dispose();
});

test('only a resolve the server calls stale asks for the list again, and every resolve can be aborted', async () => {
    const { service, editor, timers, language, dispose } = await open('p', [{ label: 'print' }, { label: 'private' }]);
    let stale = true;

    service.respond(
        'completionItem/resolve',
        (call) => {
            if (stale) {
                stale = false;

                throw new StaleResultError(uri);
            }

            return { ...(call.params as CompletionItem), documentation: 'Prints the value.' };
        },
        { resolveProvider: true }
    );

    language.completion.invoke();
    timers.advance(1);
    await settle();
    editor.type('pr');
    timers.advance(120);
    await settle();

    const completions = (): number => service.calls.filter((call) => call.method === 'textDocument/completion').length;

    expect(completions()).toBe(2);

    timers.advance(120);
    await settle();

    expect(completions()).toBe(2);

    const resolves = service.calls.filter((call) => call.method === 'completionItem/resolve');

    expect(resolves).toHaveLength(2);
    expect(resolves.every((call) => call.options.signal instanceof AbortSignal)).toBe(true);
    expect(JSON.stringify(language.popups.getState().completion?.docs)).toContain('Prints the value.');

    dispose();
});

test('a character that ends a word drops the list the letter before it asked for', async () => {
    const { service, editor, timers, language, dispose } = await open('const total = coun', [{ label: 'count' }, { label: 'counter' }]);
    editor.type('const total = count');
    editor.type('const total = count;');
    timers.advance(1_000);
    await settle();

    expect(service.calls.filter((call) => call.method === 'textDocument/completion')).toHaveLength(0);
    expect(language.completion.isOpen).toBe(false);

    dispose();
});

/* An editor of a document no server answers for, or one whose server answers `items`. */
async function openWith(text: string, items: readonly CompletionItem[] | null) {
    const context = await open(text, items ?? []);

    if (items === null) {
        context.service.providers.delete('textDocument/completion');
    }

    return context;
}

function local(label: string, accepted: string[], extra: Partial<CompletionItem> = {}) {
    return {
        item: { label, kind: 15, sortText: `￿${label}`, filterText: label, ...extra } as CompletionItem,
        accept: () => {
            accepted.push(label);
        }
    };
}

test('the rows of a source show in a document no server answers for, and accepting one runs the source', async () => {
    const accepted: string[] = [];
    const { editor, timers, language, service, dispose } = await openWith('', null);
    const off = language.completion.addSource({ items: () => [local('log', accepted), local('logger', accepted)] });
    editor.type('l');
    timers.advance(80);
    await settle();

    expect(language.completion.isOpen).toBe(true);
    expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['log', 'logger']);

    await language.completion.accept(false, 1);

    expect(accepted).toEqual(['logger']);
    expect(language.completion.isOpen).toBe(false);
    expect(editor.getText()).toBe('l');
    expect(service.calls.filter((call) => call.method.startsWith('completion'))).toEqual([]);

    off();
    editor.type('lx');
    timers.advance(80);
    await settle();

    expect(language.completion.isOpen).toBe(false);

    dispose();
});

test('the rows of a source merge with the rows of the server and sort after rows that match as well', async () => {
    const accepted: string[] = [];
    const { editor, timers, language, dispose } = await open('', [{ label: 'logging' }, { label: 'lookups' }]);
    language.completion.addSource({ items: () => [local('loggers', accepted)] });
    editor.type('l');
    timers.advance(80);
    await settle();

    expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['logging', 'lookups', 'loggers']);

    dispose();
});

test('accepting a row of a source never resolves it', async () => {
    const accepted: string[] = [];
    const { service, editor, timers, language, dispose } = await open('', [{ label: 'other' }]);
    service.respond('completionItem/resolve', (call) => call.params, { resolveProvider: true });
    language.completion.addSource({ items: () => [local('logger', accepted)] });
    editor.type('l');
    timers.advance(80);
    await settle();
    timers.advance(200);
    await settle();

    expect(service.calls.filter((call) => call.method === 'completionItem/resolve')).toEqual([]);

    await language.completion.accept(false);

    expect(accepted).toEqual(['logger']);
    expect(service.calls.filter((call) => call.method === 'completionItem/resolve')).toEqual([]);

    dispose();
});

test('a single row of a source in a list that was asked for is taken at once', async () => {
    const accepted: string[] = [];
    const { editor, timers, language, dispose } = await open('', [{ label: 'other' }]);
    language.completion.addSource({ items: () => [local('logger', accepted)] });
    editor.type('l');
    language.completion.invoke();
    timers.advance(1);
    await settle();

    expect(accepted).toEqual(['logger']);
    expect(language.completion.isOpen).toBe(false);

    dispose();
});

test('a request the server fails still leaves the rows of a source', async () => {
    const accepted: string[] = [];
    const { service, editor, timers, language, dispose } = await open('', []);
    service.respond('textDocument/completion', () => {
        throw new Error('The server broke');
    });
    language.completion.addSource({ items: () => [local('logger', accepted)] });
    editor.type('l');
    timers.advance(80);
    await settle();

    expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['logger']);

    dispose();
});

test('a source is asked with the caret and whether the list was asked for', async () => {
    const requests: unknown[] = [];
    const { editor, timers, language, dispose } = await openWith('', null);
    language.completion.addSource({
        items: (request) => {
            requests.push(request);

            return [];
        }
    });
    editor.type('l');
    timers.advance(80);
    await settle();
    language.completion.invoke();
    timers.advance(1);
    await settle();

    expect(requests).toEqual([
        { position: { line: 0, character: 1 }, explicit: false },
        { position: { line: 0, character: 1 }, explicit: true }
    ]);

    dispose();
});

test('showItems opens the list with only the given rows, which narrow as a person types', async () => {
    const accepted: string[] = [];
    const { editor, language, service, dispose } = await open('x ', [{ label: 'server' }]);
    const at = { line: 0, character: 2 };
    const row = (label: string) => local(label, accepted, { textEdit: { range: { start: at, end: at }, newText: label } });
    language.completion.showItems([row('foo'), row('bar'), row('food')], at);

    expect(language.popups.getState().completion?.rows.map((entry) => entry.label)).toEqual(['bar', 'foo', 'food']);

    editor.type('x f');

    expect(language.popups.getState().completion?.rows.map((entry) => entry.label)).toEqual(['foo', 'food']);

    editor.type('x fo');
    editor.type('x foo');

    expect(language.popups.getState().completion?.rows.map((entry) => entry.label)).toEqual(['foo', 'food']);
    expect(service.calls.filter((call) => call.method === 'textDocument/completion')).toEqual([]);

    await language.completion.accept(false);

    expect(accepted).toEqual(['foo']);

    dispose();
});

test('showItems closes when what is typed matches no row or is no part of a word', async () => {
    const accepted: string[] = [];
    const { editor, language, dispose } = await open('', []);
    const at = { line: 0, character: 0 };
    const rows = () => [local('foo', accepted, { textEdit: { range: { start: at, end: at }, newText: 'foo' } })];
    language.completion.showItems(rows(), at);
    editor.type('z');

    expect(language.completion.isOpen).toBe(false);

    language.completion.showItems(rows(), { line: 0, character: 1 });
    editor.type('z ');

    expect(language.completion.isOpen).toBe(false);

    dispose();
});
