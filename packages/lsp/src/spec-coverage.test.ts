import { describe, expect, it, jest } from 'bun:test';
import { ErrorCodes, LspError } from './connection.ts';
import type { WorkDoneProgress } from './protocol.ts';
import { flush, origin, rejecting, sessionWith } from './test-transport.ts';

const range = { start: origin, end: { line: 0, character: 3 } };

type Capabilities = {
    textDocument: Record<string, unknown>;
    workspace: Record<string, unknown>;
    window: Record<string, unknown>;
    general: Record<string, unknown>;
};

describe('client capabilities', () => {
    it('announces every language feature of the specification it can ask for', async () => {
        const { session, transport } = await sessionWith({});
        const { capabilities } = transport.request('initialize').params as { capabilities: Capabilities };
        for (const feature of ['documentLink', 'colorProvider', 'linkedEditingRange', 'moniker', 'typeHierarchy', 'inlineValue', 'inlineCompletion']) {
            expect(capabilities.textDocument[feature]).toMatchObject({ dynamicRegistration: true });
        }
        expect(capabilities.textDocument.synchronization).toMatchObject({ willSave: true, willSaveWaitUntil: true, didSave: true });
        expect(capabilities.textDocument.rangeFormatting).toMatchObject({ rangesSupport: true });
        expect(capabilities.workspace).toMatchObject({ inlineValue: { refreshSupport: true }, foldingRange: { refreshSupport: true } });
        expect(capabilities.window).toMatchObject({ showDocument: { support: false } });
        expect(capabilities.general).toMatchObject({ staleRequestSupport: { cancel: true } });
        await session.shutdown();
    });

    it('sends the trace level and the locale with initialize, and supports showing documents when the host does', async () => {
        const { session, transport } = await sessionWith({}, { trace: 'messages', locale: 'nl', onShowDocument: () => ({ success: true }) });
        const params = transport.request('initialize').params as { trace: string; locale: string; capabilities: Capabilities };
        expect(params.trace).toBe('messages');
        expect(params.locale).toBe('nl');
        expect(params.capabilities.window).toMatchObject({ showDocument: { support: true } });
        await session.shutdown();
    });
});

describe('language features', () => {
    it('asks each new request of a document with its text document and params', async () => {
        const { session, transport } = await sessionWith({
            documentLinkProvider: { resolveProvider: true },
            colorProvider: true,
            linkedEditingRangeProvider: true,
            monikerProvider: true,
            typeHierarchyProvider: true,
            inlineValueProvider: true,
            inlineCompletionProvider: true,
            documentRangeFormattingProvider: { rangesSupport: true }
        });
        const document = session.openDocument({ uri: 'file:///a.css', languageId: 'css', text: 'red' });
        await document.ready;
        const color = { red: 1, green: 0, blue: 0, alpha: 1 };
        const asks: [string, () => Promise<unknown>, object][] = [
            ['textDocument/documentLink', () => document.documentLinks(), {}],
            ['textDocument/documentColor', () => document.documentColors(), {}],
            ['textDocument/colorPresentation', () => document.colorPresentations(color, range), { color, range }],
            ['textDocument/linkedEditingRange', () => document.linkedEditingRanges(origin), { position: origin }],
            ['textDocument/moniker', () => document.monikers(origin), { position: origin }],
            ['textDocument/prepareTypeHierarchy', () => document.prepareTypeHierarchy(origin), { position: origin }],
            ['textDocument/inlineValue', () => document.inlineValues(range, { frameId: 1, stoppedLocation: range }), { range }],
            ['textDocument/inlineCompletion', () => document.inlineCompletions(origin, { triggerKind: 1 }), { position: origin, context: { triggerKind: 1 } }],
            ['textDocument/rangesFormatting', () => document.rangesFormatting([range], { tabSize: 4, insertSpaces: true }), { ranges: [range] }]
        ];
        for (const [method, ask, params] of asks) {
            const answer = ask();
            await flush();
            expect(transport.request(method).params).toMatchObject({ textDocument: { uri: 'file:///a.css' }, ...params });
            transport.respond(method, null);
            expect(await answer).toBeNull();
        }
        await session.shutdown();
    });

    it('resolves a link and walks a type hierarchy with the item the server gave', async () => {
        const { session, transport } = await sessionWith({ documentLinkProvider: { resolveProvider: true }, typeHierarchyProvider: true });
        const document = session.openDocument({ uri: 'file:///a.ts', languageId: 'typescript', text: 'class A {}' });
        await document.ready;
        const link = { range, data: 7 };
        const resolving = document.resolveDocumentLink(link);
        await flush();
        expect(transport.request('documentLink/resolve').params).toEqual(link);
        transport.respond('documentLink/resolve', { ...link, target: 'https://example.com' });
        expect((await resolving).target).toBe('https://example.com');
        const item = { name: 'A', kind: 5 as const, uri: 'file:///a.ts', range, selectionRange: range };
        const supertypes = document.supertypes(item);
        const subtypes = document.subtypes(item);
        await flush();
        transport.respond('typeHierarchy/supertypes', []);
        transport.respond('typeHierarchy/subtypes', [item]);
        expect(await supertypes).toEqual([]);
        expect(await subtypes).toEqual([item]);
        await session.shutdown();
    });

    it('asks only for ranges formatting from a server that formats several ranges at once', async () => {
        const { session } = await sessionWith({ documentRangeFormattingProvider: true });
        const document = session.openDocument({ uri: 'file:///a.ts', languageId: 'typescript', text: 'x' });
        await document.ready;
        expect(session.supports('textDocument/rangeFormatting', document)).toBe(true);
        expect(session.supports('textDocument/rangesFormatting', document)).toBe(false);
        await rejecting(document.rangesFormatting([range], { tabSize: 4, insertSpaces: true }), (error) => {
            expect((error as LspError).code).toBe(ErrorCodes.MethodNotFound);
        });
        await session.shutdown();
    });
});

describe('saving', () => {
    it('tells a server that asked before a save, and takes the edits it wants first', async () => {
        const { session, transport } = await sessionWith({ textDocumentSync: { openClose: true, change: 2, willSave: true, willSaveWaitUntil: true } });
        const document = session.openDocument({ uri: 'file:///a.ts', languageId: 'typescript', text: 'x' });
        await document.ready;
        await document.willSave(2);
        expect(transport.sent).toContainEqual({
            jsonrpc: '2.0',
            method: 'textDocument/willSave',
            params: { textDocument: { uri: 'file:///a.ts' }, reason: 2 }
        });
        const edits = document.willSaveWaitUntil();
        await flush();
        expect(transport.request('textDocument/willSaveWaitUntil').params).toEqual({ textDocument: { uri: 'file:///a.ts' }, reason: 1 });
        const edit = { range, newText: 'y' };
        transport.respond('textDocument/willSaveWaitUntil', [edit]);
        expect(await edits).toEqual([edit]);
        await session.shutdown();
    });

    it('sends nothing before a save to a server that did not ask', async () => {
        const { session, transport } = await sessionWith({ textDocumentSync: 2 });
        const document = session.openDocument({ uri: 'file:///a.ts', languageId: 'typescript', text: 'x' });
        await document.ready;
        await document.willSave();
        expect(await document.willSaveWaitUntil()).toBeNull();
        expect(transport.methods()).not.toContain('textDocument/willSave');
        await session.shutdown();
    });
});

describe('window and lifecycle', () => {
    it('hands messages, logs, traces and telemetry of the server to the host', async () => {
        const onMessage = jest.fn();
        const onLog = jest.fn();
        const onTrace = jest.fn();
        const onTelemetry = jest.fn();
        const { session, transport } = await sessionWith({}, { onMessage, onLog, onTrace, onTelemetry });
        transport.emit({ jsonrpc: '2.0', method: 'window/showMessage', params: { type: 2, message: 'Careful' } });
        transport.emit({ jsonrpc: '2.0', method: 'window/logMessage', params: { type: 4, message: 'Started' } });
        transport.emit({ jsonrpc: '2.0', method: '$/logTrace', params: { message: 'trace' } });
        transport.emit({ jsonrpc: '2.0', method: 'telemetry/event', params: { name: 'opened' } });
        await flush();
        expect(onMessage).toHaveBeenCalledWith({ type: 2, message: 'Careful' });
        expect(onLog).toHaveBeenCalledWith({ type: 4, message: 'Started' });
        expect(onTrace).toHaveBeenCalledWith({ message: 'trace' });
        expect(onTelemetry).toHaveBeenCalledWith({ name: 'opened' });
        await session.shutdown();
    });

    it('answers showDocument through the host, and that it did not without one', async () => {
        const shown = await sessionWith({}, { onShowDocument: (params) => ({ success: params.external === true }) });
        shown.transport.emit({ jsonrpc: '2.0', id: 'show', method: 'window/showDocument', params: { uri: 'https://example.com', external: true } });
        await flush();
        expect(shown.transport.sent).toContainEqual({ jsonrpc: '2.0', id: 'show', result: { success: true } });
        await shown.session.shutdown();
        const plain = await sessionWith({});
        plain.transport.emit({ jsonrpc: '2.0', id: 'show', method: 'window/showDocument', params: { uri: 'file:///a.ts' } });
        await flush();
        expect(plain.transport.sent).toContainEqual({ jsonrpc: '2.0', id: 'show', result: { success: false } });
        await plain.session.shutdown();
    });

    it('sets the trace level and cancels work the server reported', async () => {
        const { session, transport } = await sessionWith({});
        await session.setTrace('verbose');
        await session.cancelWorkDoneProgress('index');
        expect(transport.sent).toContainEqual({ jsonrpc: '2.0', method: '$/setTrace', params: { value: 'verbose' } });
        expect(transport.sent).toContainEqual({ jsonrpc: '2.0', method: 'window/workDoneProgress/cancel', params: { token: 'index' } });
        await session.shutdown();
    });

    it('streams partial results and work-done progress of a request under tokens of its own', async () => {
        const { session, transport } = await sessionWith({ referencesProvider: true });
        const document = session.openDocument({ uri: 'file:///a.ts', languageId: 'typescript', text: 'x' });
        await document.ready;
        const parts: unknown[] = [];
        const progress: WorkDoneProgress[] = [];
        const answer = document.request(
            'textDocument/references',
            { position: origin, context: { includeDeclaration: true } },
            {
                onPartialResult: (part) => parts.push(part),
                onWorkDoneProgress: (report) => progress.push(report)
            }
        );
        await flush();
        const { partialResultToken, workDoneToken } = transport.request('textDocument/references').params as {
            partialResultToken: string;
            workDoneToken: string;
        };
        expect(partialResultToken).not.toBe(workDoneToken);
        transport.emit({ jsonrpc: '2.0', method: '$/progress', params: { token: workDoneToken, value: { kind: 'begin', title: 'Searching' } } });
        transport.emit({ jsonrpc: '2.0', method: '$/progress', params: { token: partialResultToken, value: [{ uri: 'file:///b.ts', range }] } });
        transport.emit({ jsonrpc: '2.0', method: '$/progress', params: { token: 'other', value: [] } });
        await flush();
        transport.respond('textDocument/references', []);
        expect(await answer).toEqual([]);
        expect(parts).toEqual([[{ uri: 'file:///b.ts', range }]]);
        expect(progress).toEqual([{ kind: 'begin', title: 'Searching' }]);
        await session.shutdown();
    });
});

describe('workspace', () => {
    it('keeps the folders and tells a server that asked for changes', async () => {
        const { session, transport } = await sessionWith(
            { workspace: { workspaceFolders: { supported: true, changeNotifications: true } } },
            {
                workspaceFolders: [{ uri: 'file:///one', name: 'one' }]
            }
        );
        await session.changeWorkspaceFolders({ added: [{ uri: 'file:///two', name: 'two' }], removed: [{ uri: 'file:///one', name: 'one' }] });
        expect(session.workspaceFolders).toEqual([{ uri: 'file:///two', name: 'two' }]);
        expect(transport.sent).toContainEqual({
            jsonrpc: '2.0',
            method: 'workspace/didChangeWorkspaceFolders',
            params: { event: { added: [{ uri: 'file:///two', name: 'two' }], removed: [{ uri: 'file:///one', name: 'one' }] } }
        });
        await session.shutdown();
    });

    it('asks for the diagnostics of the workspace only from a server that offers them', async () => {
        const offered = await sessionWith({ diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: true } });
        const answer = offered.session.workspaceDiagnostics([{ uri: 'file:///a.ts', value: '1' }]);
        await flush();
        expect(offered.transport.request('workspace/diagnostic').params).toEqual({ previousResultIds: [{ uri: 'file:///a.ts', value: '1' }] });
        offered.transport.respond('workspace/diagnostic', { items: [] });
        expect(await answer).toEqual({ items: [] });
        await offered.session.shutdown();
        const plain = await sessionWith({ diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false } });
        await rejecting(plain.session.workspaceDiagnostics(), (error) => expect((error as LspError).code).toBe(ErrorCodes.MethodNotFound));
        await plain.session.shutdown();
    });

    it('lets the diagnostics of the workspace wait as long as the server polls, unless the caller sets a deadline', async () => {
        jest.useFakeTimers();

        try {
            const offered = await sessionWith({ diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: true } }, { timeoutMs: 10 });
            const answer = offered.session.workspaceDiagnostics();
            await flush();
            jest.advanceTimersByTime(1_000);
            offered.transport.respond('workspace/diagnostic', { items: [] });
            expect(await answer).toEqual({ items: [] });

            const bounded = rejecting(offered.session.workspaceDiagnostics([], undefined, { timeoutMs: 10 }), (error) =>
                expect((error as Error).message).toContain('timed out')
            );
            await flush();
            jest.advanceTimersByTime(10);
            await bounded;
            await offered.session.shutdown();
        } finally {
            jest.useRealTimers();
        }
    });

    it('tells a server only the folders that really changed', async () => {
        const { session, transport } = await sessionWith(
            { workspace: { workspaceFolders: { supported: true, changeNotifications: true } } },
            { workspaceFolders: [{ uri: 'file:///one', name: 'one' }] }
        );
        const two = { uri: 'file:///two', name: 'two' };
        await session.changeWorkspaceFolders({
            added: [{ uri: 'file:///one', name: 'one' }, two, two],
            removed: [{ uri: 'file:///three', name: 'three' }]
        });
        expect(session.workspaceFolders).toEqual([{ uri: 'file:///one', name: 'one' }, two]);
        expect(transport.sent.filter((message) => 'method' in message && message.method === 'workspace/didChangeWorkspaceFolders')).toEqual([
            { jsonrpc: '2.0', method: 'workspace/didChangeWorkspaceFolders', params: { event: { added: [two], removed: [] } } }
        ]);

        await session.changeWorkspaceFolders({ added: [two], removed: [] });
        expect(transport.methods().filter((method) => method === 'workspace/didChangeWorkspaceFolders')).toHaveLength(1);
        await session.shutdown();
    });

    it('reads documents of a scheme the server serves', async () => {
        const { session, transport } = await sessionWith({ workspace: { textDocumentContent: { schemes: ['jdt'] } } });
        const answer = session.textDocumentContent('jdt://contents/A.class');
        await flush();
        transport.respond('workspace/textDocumentContent', { text: 'class A {}' });
        expect(await answer).toEqual({ text: 'class A {}' });
        await rejecting(session.textDocumentContent('other://x'), (error) => expect((error as LspError).code).toBe(ErrorCodes.MethodNotFound));
        await session.shutdown();
    });

    it('treats the new refresh requests as a change of what a document may ask', async () => {
        const changed = jest.fn();
        const { session, transport } = await sessionWith({});
        session.onCapabilitiesChanged(changed);
        for (const method of ['workspace/inlineValue/refresh', 'workspace/foldingRange/refresh', 'workspace/textDocumentContent/refresh']) {
            transport.emit({ jsonrpc: '2.0', id: method, method, params: null });
        }
        await flush();
        expect(changed).toHaveBeenCalledTimes(3);
        await session.shutdown();
    });
});

describe('notebooks', () => {
    const notebook = { uri: 'file:///work/a.ipynb', notebookType: 'jupyter-notebook', version: 1, cells: [{ kind: 2 as const, document: 'cell:1' }] };

    it('synchronizes a notebook the server selects', async () => {
        const { session, transport } = await sessionWith({ notebookDocumentSync: { notebookSelector: [{ notebook: 'jupyter-notebook' }], save: true } });
        await session.openNotebook(notebook, [{ uri: 'cell:1', languageId: 'python', text: 'x = 1' }]);
        await session.changeNotebook({ ...notebook, version: 2 }, { cells: { data: notebook.cells } });
        await session.saveNotebook(notebook);
        await session.closeNotebook(notebook, ['cell:1']);
        expect(transport.methods().filter((method) => method.startsWith('notebookDocument/'))).toEqual([
            'notebookDocument/didOpen',
            'notebookDocument/didChange',
            'notebookDocument/didSave',
            'notebookDocument/didClose'
        ]);
        expect(transport.sent).toContainEqual({
            jsonrpc: '2.0',
            method: 'notebookDocument/didOpen',
            params: { notebookDocument: notebook, cellTextDocuments: [{ uri: 'cell:1', languageId: 'python', text: 'x = 1', version: 0 }] }
        });
        await session.shutdown();
    });

    it('sends nothing for a notebook the server does not select', async () => {
        const { session, transport } = await sessionWith({ notebookDocumentSync: { notebookSelector: [{ notebook: { notebookType: 'other' } }] } });
        await session.openNotebook(notebook, []);
        expect(session.syncsNotebook(notebook)).toBe(false);
        expect(transport.methods().some((method) => method.startsWith('notebookDocument/'))).toBe(false);
        await session.shutdown();
    });
});
