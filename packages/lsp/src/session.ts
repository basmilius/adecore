import { ErrorCodes, JsonRpcConnection, LspError, type RequestHandler } from './connection.ts';
import { LspDocument } from './document.ts';
import { createsTaken, deletesTaken, renamesTaken, type CreatedFile, type DeletedFile, type RenamedFile } from './file-operations.ts';
import { globMatch } from './glob.ts';
import { fileUriKey } from './uris.ts';
import type { ResourceOperationKind } from './workspace-operations.ts';
import type {
    ApplyWorkspaceEditParams,
    ApplyWorkspaceEditResult,
    Command,
    ConfigurationItem,
    Disposable,
    DocumentItem,
    FileEvent,
    FileOperation,
    FileOperationFilter,
    FileSystemWatcher,
    InitializeResult,
    LogMessageParams,
    LogTraceParams,
    LspTransport,
    MessageActionItem,
    NotebookDocument,
    NotebookDocumentChangeEvent,
    PreviousResultId,
    ProgressParams,
    ProgressToken,
    ProviderOptions,
    PublishDiagnosticsParams,
    Registration,
    RequestOptions,
    ServerCapabilities,
    ShowDocumentParams,
    ShowDocumentResult,
    ShowMessageParams,
    ShowMessageRequestParams,
    TextDocumentContentResult,
    TextDocumentSyncOptions,
    TraceValue,
    WorkspaceDiagnosticReport,
    WorkspaceEdit,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent,
    WorkspaceSymbol,
    WorkspaceSymbolResult
} from './protocol.ts';

export type SessionState = 'new' | 'initializing' | 'ready' | 'closing' | 'closed';

export interface LspSessionOptions {
    rootUri?: string | null;
    workspaceFolders?: WorkspaceFolder[];
    initializationOptions?: unknown;
    /* Sent after `initialized` and answered to every configuration query, before any document opens. */
    configuration?: Record<string, unknown>;
    clientInfo?: { name: string; version?: string };
    timeoutMs?: number;
    /* How long the changes for a server with full sync gather before the whole text goes out; 200 by default. */
    fullSyncDelayMs?: number;
    snippetSupport?: boolean;
    insertTextModes?: readonly (1 | 2)[];
    completionItemDefaults?: readonly string[];
    /*
     * The resource operations the host carries out for a workspace edit, announced to servers. Defaults to create
     * and rename. The failure handling is `abort`: the client stops at the first change that fails, and the changes
     * that already ran are not rolled back.
     */
    resourceOperations?: readonly ResourceOperationKind[];
    onConfiguration?: (item: ConfigurationItem) => unknown | Promise<unknown>;
    onApplyEdit?: (params: ApplyWorkspaceEditParams) => ApplyWorkspaceEditResult | Promise<ApplyWorkspaceEditResult>;
    /* Answers `window/showMessageRequest` with the action a person chose, or null when they dismissed it. */
    onShowMessage?: (params: ShowMessageRequestParams) => MessageActionItem | null | Promise<MessageActionItem | null>;
    /* A message the server wants a person to read, without an answer (`window/showMessage`). */
    onMessage?: (params: ShowMessageParams) => void;
    /* A line for a log of the server (`window/logMessage`). */
    onLog?: (params: LogMessageParams) => void;
    /* A trace of the server, sent while `trace` is not `off` (`$/logTrace`). */
    onTrace?: (params: LogTraceParams) => void;
    onTelemetry?: (data: unknown) => void;
    /* Shows a document or a web address the server asks for; without it the client answers that it did not. */
    onShowDocument?: (params: ShowDocumentParams) => ShowDocumentResult | Promise<ShowDocumentResult>;
    /* The trace level sent with `initialize`; `setTrace` changes it later. `off` by default. */
    trace?: TraceValue;
    /* The language of the interface, such as `en` or `nl-NL`, for the server's messages. */
    locale?: string;
}

/* The capability that advertises each method statically. */
const PROVIDERS: Record<string, keyof ServerCapabilities> = {
    'textDocument/completion': 'completionProvider',
    'completionItem/resolve': 'completionProvider',
    'textDocument/hover': 'hoverProvider',
    'textDocument/signatureHelp': 'signatureHelpProvider',
    'textDocument/definition': 'definitionProvider',
    'textDocument/declaration': 'declarationProvider',
    'textDocument/typeDefinition': 'typeDefinitionProvider',
    'textDocument/implementation': 'implementationProvider',
    'textDocument/references': 'referencesProvider',
    'textDocument/prepareRename': 'renameProvider',
    'textDocument/documentHighlight': 'documentHighlightProvider',
    'textDocument/documentSymbol': 'documentSymbolProvider',
    'workspace/symbol': 'workspaceSymbolProvider',
    'workspaceSymbol/resolve': 'workspaceSymbolProvider',
    'textDocument/rename': 'renameProvider',
    'textDocument/codeAction': 'codeActionProvider',
    'codeAction/resolve': 'codeActionProvider',
    'textDocument/codeLens': 'codeLensProvider',
    'codeLens/resolve': 'codeLensProvider',
    'workspace/executeCommand': 'executeCommandProvider',
    'textDocument/formatting': 'documentFormattingProvider',
    'textDocument/rangeFormatting': 'documentRangeFormattingProvider',
    'textDocument/onTypeFormatting': 'documentOnTypeFormattingProvider',
    'textDocument/foldingRange': 'foldingRangeProvider',
    'textDocument/selectionRange': 'selectionRangeProvider',
    'textDocument/semanticTokens/full': 'semanticTokensProvider',
    'textDocument/semanticTokens/full/delta': 'semanticTokensProvider',
    'textDocument/semanticTokens/range': 'semanticTokensProvider',
    'textDocument/inlayHint': 'inlayHintProvider',
    'inlayHint/resolve': 'inlayHintProvider',
    'textDocument/prepareCallHierarchy': 'callHierarchyProvider',
    'callHierarchy/incomingCalls': 'callHierarchyProvider',
    'callHierarchy/outgoingCalls': 'callHierarchyProvider',
    'textDocument/diagnostic': 'diagnosticProvider',
    'workspace/diagnostic': 'diagnosticProvider',
    'textDocument/documentLink': 'documentLinkProvider',
    'documentLink/resolve': 'documentLinkProvider',
    'textDocument/documentColor': 'colorProvider',
    'textDocument/colorPresentation': 'colorProvider',
    'textDocument/linkedEditingRange': 'linkedEditingRangeProvider',
    'textDocument/moniker': 'monikerProvider',
    'textDocument/prepareTypeHierarchy': 'typeHierarchyProvider',
    'typeHierarchy/supertypes': 'typeHierarchyProvider',
    'typeHierarchy/subtypes': 'typeHierarchyProvider',
    'textDocument/inlineValue': 'inlineValueProvider',
    'textDocument/inlineCompletion': 'inlineCompletionProvider',
    'textDocument/rangesFormatting': 'documentRangeFormattingProvider'
};

/* A method whose dynamic registration is made under the name of another. */
const REGISTRATION_METHODS: Record<string, string> = {
    'completionItem/resolve': 'textDocument/completion',
    'codeAction/resolve': 'textDocument/codeAction',
    'codeLens/resolve': 'textDocument/codeLens',
    'inlayHint/resolve': 'textDocument/inlayHint',
    'callHierarchy/incomingCalls': 'textDocument/prepareCallHierarchy',
    'callHierarchy/outgoingCalls': 'textDocument/prepareCallHierarchy',
    'textDocument/prepareRename': 'textDocument/rename',
    'workspaceSymbol/resolve': 'workspace/symbol',
    'textDocument/semanticTokens/full': 'textDocument/semanticTokens',
    'textDocument/semanticTokens/full/delta': 'textDocument/semanticTokens',
    'textDocument/semanticTokens/range': 'textDocument/semanticTokens',
    'documentLink/resolve': 'textDocument/documentLink',
    'textDocument/colorPresentation': 'textDocument/documentColor',
    'typeHierarchy/supertypes': 'textDocument/prepareTypeHierarchy',
    'typeHierarchy/subtypes': 'textDocument/prepareTypeHierarchy',
    'textDocument/rangesFormatting': 'textDocument/rangeFormatting',
    'workspace/diagnostic': 'textDocument/diagnostic'
};

const REFRESH_REQUESTS = [
    'workspace/semanticTokens/refresh',
    'workspace/inlayHint/refresh',
    'workspace/diagnostic/refresh',
    'workspace/codeLens/refresh',
    'workspace/inlineValue/refresh',
    'workspace/foldingRange/refresh',
    'workspace/textDocumentContent/refresh'
];

function matches(options: ProviderOptions, document?: Pick<DocumentItem, 'uri' | 'languageId'>): boolean {
    if (options.documentSelector == null) {
        return true;
    }

    if (!document) {
        return options.documentSelector.length > 0;
    }

    const url = new URL(document.uri);

    return options.documentSelector.some(
        (filter) =>
            (!filter.language || filter.language === document.languageId) &&
            (!filter.scheme || filter.scheme === url.protocol.slice(0, -1)) &&
            (!filter.pattern || globMatch(decodeURIComponent(url.pathname), filter.pattern))
    );
}

/* Whether provider options cover a method that a provider only offers on top of its feature. */
function offersMethod(method: string, options: ProviderOptions): boolean {
    if (method.endsWith('/resolve')) {
        return options.resolveProvider === true;
    }

    if (method === 'textDocument/prepareRename') {
        return options.prepareProvider === true;
    }

    if (method === 'textDocument/semanticTokens/full/delta') {
        return typeof options.full === 'object' && options.full.delta === true;
    }

    if (method === 'textDocument/semanticTokens/full') {
        return !!options.full;
    }

    if (method === 'textDocument/semanticTokens/range') {
        return !!options.range;
    }

    if (method === 'textDocument/rangesFormatting') {
        return options.rangesSupport === true;
    }

    if (method === 'workspace/diagnostic') {
        return options.workspaceDiagnostics === true;
    }

    return true;
}

/* One conversation with one language server: the handshake, what it can do, and the documents open in it. */
export class LspSession {
    readonly connection: JsonRpcConnection;
    readonly options: LspSessionOptions;
    serverInfo?: InitializeResult['serverInfo'];
    private phase: SessionState = 'new';
    private initialized?: Promise<InitializeResult>;
    private shutdownPromise?: Promise<void>;
    private serverCapabilities: ServerCapabilities = {};
    private readonly registrations = new Map<string, Registration>();
    private readonly documents = new Map<string, LspDocument>();
    private readonly diagnosticListeners = new Set<(params: PublishDiagnosticsParams) => void>();
    private readonly capabilityListeners = new Set<() => void>();
    private configuration: Record<string, unknown>;
    private folders: WorkspaceFolder[] | null;

    constructor(transport: LspTransport, options: LspSessionOptions = {}) {
        this.options = options;
        this.connection = new JsonRpcConnection(transport, options.timeoutMs);
        this.configuration = options.configuration ?? {};

        this.connection.onClose(() => {
            this.phase = 'closed';

            for (const document of [...this.documents.values()]) {
                document.disconnect();
            }
        });

        this.connection.onNotification('textDocument/publishDiagnostics', (params) => {
            const diagnostics = params as PublishDiagnosticsParams;
            const document = this.documents.get(fileUriKey(diagnostics.uri));

            if (!document || document.isClosed || (diagnostics.version !== undefined && diagnostics.version !== document.version)) {
                return;
            }

            this.emitDiagnostics({ ...diagnostics, uri: document.uri });
        });

        this.connection.onRequest('workspace/configuration', async (params) => {
            const { items } = params as { items: ConfigurationItem[] };

            return Promise.all(items.map((item) => (options.onConfiguration ? options.onConfiguration(item) : this.readConfiguration(item.section))));
        });

        this.folders = options.workspaceFolders ?? (options.rootUri ? [{ uri: options.rootUri, name: 'Workspace' }] : null);
        this.connection.onRequest('workspace/workspaceFolders', () => this.workspaceFolders);

        this.connection.onRequest(
            'workspace/applyEdit',
            (params) => options.onApplyEdit?.(params as ApplyWorkspaceEditParams) ?? { applied: false, failureReason: 'No workspace edit handler is attached' }
        );

        this.connection.onRequest('window/showMessageRequest', (params) => options.onShowMessage?.(params as ShowMessageRequestParams) ?? null);
        this.connection.onRequest('window/showDocument', (params) => options.onShowDocument?.(params as ShowDocumentParams) ?? { success: false });
        this.connection.onNotification('window/showMessage', (params) => options.onMessage?.(params as ShowMessageParams));
        this.connection.onNotification('window/logMessage', (params) => options.onLog?.(params as LogMessageParams));
        this.connection.onNotification('$/logTrace', (params) => options.onTrace?.(params as LogTraceParams));
        this.connection.onNotification('telemetry/event', (params) => options.onTelemetry?.(params));
        this.connection.onRequest('window/workDoneProgress/create', () => null);

        this.connection.onRequest('client/registerCapability', (params) => {
            const { registrations } = params as { registrations: Registration[] };

            for (const registration of registrations) {
                this.registrations.set(registration.id, registration);
            }

            this.emitCapabilities();

            return null;
        });

        this.connection.onRequest('client/unregisterCapability', (params) => {
            // The misspelled field is part of the LSP 3.17 wire protocol.
            const { unregisterations } = params as { unregisterations: { id: string; method: string }[] };

            for (const registration of unregisterations) {
                this.registrations.delete(registration.id);
            }

            this.emitCapabilities();

            return null;
        });

        for (const method of REFRESH_REQUESTS) {
            this.connection.onRequest(method, () => {
                this.emitCapabilities();

                return null;
            });
        }
    }

    get state(): SessionState {
        return this.phase;
    }

    get capabilities(): Readonly<ServerCapabilities> {
        return this.serverCapabilities;
    }

    get workspaceFolders(): WorkspaceFolder[] | null {
        return this.folders === null ? null : [...this.folders];
    }

    get syncOptions(): TextDocumentSyncOptions {
        const sync = this.serverCapabilities.textDocumentSync;

        return typeof sync === 'number' ? { openClose: sync !== 0, change: sync } : (sync ?? {});
    }

    initialize(): Promise<InitializeResult> {
        if (this.initialized) {
            return this.initialized;
        }

        if (this.phase !== 'new') {
            return Promise.reject(new LspError(`Cannot initialize a ${this.phase} session`));
        }

        this.phase = 'initializing';

        this.initialized = (async () => {
            try {
                const result = await this.connection.request<InitializeResult>('initialize', {
                    processId: null,
                    rootUri: this.options.rootUri ?? null,
                    workspaceFolders: this.workspaceFolders,
                    clientInfo: this.options.clientInfo ?? { name: '@adecore/lsp' },
                    locale: this.options.locale,
                    trace: this.options.trace ?? 'off',
                    capabilities: clientCapabilities(this.options),
                    initializationOptions: this.options.initializationOptions
                });

                if (result.capabilities.positionEncoding && result.capabilities.positionEncoding !== 'utf-16') {
                    throw new LspError(`Unsupported server position encoding: ${result.capabilities.positionEncoding}`);
                }

                this.serverCapabilities = result.capabilities;
                this.serverInfo = result.serverInfo;
                await this.connection.notify('initialized', {});
                this.phase = 'ready';

                if (this.options.configuration !== undefined) {
                    await this.connection.notify('workspace/didChangeConfiguration', { settings: this.configuration });
                }

                this.emitCapabilities();

                return result;
            } catch (error) {
                await this.connection.close();

                throw error;
            }
        })();

        return this.initialized;
    }

    openDocument(item: DocumentItem): LspDocument {
        this.assertReady();

        if (this.documents.has(fileUriKey(item.uri))) {
            throw new LspError(`Document already open: ${item.uri}`);
        }

        const document = new LspDocument(this, item);
        this.documents.set(fileUriKey(item.uri), document);

        return document;
    }

    getDocument(uri: string): LspDocument | undefined {
        return this.documents.get(fileUriKey(uri));
    }

    /* The options the server gave a method, from its capabilities or a registration whose selector takes `document`. */
    providerOptions(method: string, document?: Pick<DocumentItem, 'uri' | 'languageId'>): ProviderOptions | undefined {
        const name = REGISTRATION_METHODS[method] ?? method;
        const candidates: ProviderOptions[] = [];

        for (const registration of this.registrations.values()) {
            if (registration.method === name && matches(registration.registerOptions ?? {}, document)) {
                candidates.push(registration.registerOptions ?? {});
            }
        }

        if (method === 'textDocument/willSaveWaitUntil' && this.syncOptions.willSaveWaitUntil) {
            candidates.push({});
        }

        const content = this.serverCapabilities.workspace?.textDocumentContent;

        if (method === 'workspace/textDocumentContent' && content !== undefined) {
            candidates.push({ schemes: content.schemes });
        }

        const provider = PROVIDERS[method] === undefined ? undefined : this.serverCapabilities[PROVIDERS[method]];

        if (provider === true) {
            candidates.push({});
        } else if (provider && typeof provider === 'object' && matches(provider as ProviderOptions, document)) {
            candidates.push(provider as ProviderOptions);
        }

        return candidates.find((options) => offersMethod(method, options));
    }

    supports(method: string, document?: Pick<DocumentItem, 'uri' | 'languageId'>): boolean {
        return this.phase === 'ready' && this.providerOptions(method, document) !== undefined;
    }

    request<T = unknown>(method: string, params?: unknown, options?: RequestOptions): Promise<T> {
        this.assertReady();

        return this.connection.request<T>(method, params, options);
    }

    notify(method: string, params?: unknown): Promise<void> {
        this.assertReady();

        return this.connection.notify(method, params);
    }

    executeCommand<T = unknown>(command: Command | string, args?: unknown[], options?: RequestOptions): Promise<T> {
        if (!this.supports('workspace/executeCommand')) {
            return Promise.reject(new LspError('Server does not support commands', ErrorCodes.MethodNotFound));
        }

        return this.request('workspace/executeCommand', typeof command === 'string' ? { command, arguments: args } : command, options);
    }

    workspaceSymbols(query: string, options?: RequestOptions): Promise<WorkspaceSymbolResult> {
        if (!this.supports('workspace/symbol')) {
            return Promise.reject(new LspError('Server does not support workspace symbols', ErrorCodes.MethodNotFound));
        }

        return this.request('workspace/symbol', { query }, options);
    }

    resolveWorkspaceSymbol(symbol: WorkspaceSymbol, options?: RequestOptions): Promise<WorkspaceSymbol> {
        if (!this.supports('workspaceSymbol/resolve')) {
            return Promise.reject(new LspError('Server does not support workspace symbol resolution', ErrorCodes.MethodNotFound));
        }

        return this.request('workspaceSymbol/resolve', symbol, options);
    }

    /*
     * The diagnostics of every file of the project, for a server that offers them. `previousResultIds` are what the
     * client last heard per document, so the server can answer `unchanged`; `onPartialResult` streams reports while it works.
     */
    workspaceDiagnostics(
        previousResultIds: readonly PreviousResultId[] = [],
        identifier?: string,
        options?: RequestOptions
    ): Promise<WorkspaceDiagnosticReport> {
        if (!this.supports('workspace/diagnostic')) {
            return Promise.reject(new LspError('Server does not support workspace diagnostics', ErrorCodes.MethodNotFound));
        }
        return this.request('workspace/diagnostic', { identifier, previousResultIds: [...previousResultIds] }, options);
    }

    /* The text of a document of a scheme the server owns, such as a decompiled class, which is shown read-only. */
    textDocumentContent(uri: string, options?: RequestOptions): Promise<TextDocumentContentResult> {
        const scheme = uri.slice(0, Math.max(0, uri.indexOf(':')));
        if (!this.providerOptions('workspace/textDocumentContent')?.schemes?.includes(scheme)) {
            return Promise.reject(new LspError(`Server does not serve documents of ${scheme}:`, ErrorCodes.MethodNotFound));
        }
        return this.request('workspace/textDocumentContent', { uri }, options);
    }

    /* Changes the trace level the server sends `$/logTrace` at. */
    setTrace(value: TraceValue): Promise<void> {
        return this.notify('$/setTrace', { value });
    }

    /* Asks the server to stop work it reported as cancellable under `token`. */
    cancelWorkDoneProgress(token: ProgressToken): Promise<void> {
        return this.notify('window/workDoneProgress/cancel', { token });
    }

    /* Adds and removes folders of the workspace, and tells a server that asked to hear about it. */
    async changeWorkspaceFolders(event: WorkspaceFoldersChangeEvent): Promise<void> {
        const asked = new Set(event.removed.map((folder) => fileUriKey(folder.uri)));
        const current = this.folders ?? [];
        const removed = current.filter((folder) => asked.has(fileUriKey(folder.uri)));
        const kept = current.filter((folder) => !asked.has(fileUriKey(folder.uri)));
        const known = new Set(kept.map((folder) => fileUriKey(folder.uri)));
        const added: WorkspaceFolder[] = [];
        for (const folder of event.added) {
            if (!known.has(fileUriKey(folder.uri))) {
                known.add(fileUriKey(folder.uri));
                added.push(folder);
            }
        }
        this.folders = [...kept, ...added];
        if (removed.length === 0 && added.length === 0) {
            return;
        }
        const notifications = this.serverCapabilities.workspace?.workspaceFolders?.changeNotifications;
        const registered = [...this.registrations.values()].some((registration) => registration.method === 'workspace/didChangeWorkspaceFolders');
        if (this.phase === 'ready' && (notifications === true || typeof notifications === 'string' || registered)) {
            await this.notify('workspace/didChangeWorkspaceFolders', { event: { added, removed } });
        }
    }

    /* Whether the server synchronizes notebooks of this type and scheme; the `notebook*` methods do nothing for one it does not. */
    syncsNotebook(notebook: Pick<NotebookDocument, 'uri' | 'notebookType'>): boolean {
        const selectors = this.serverCapabilities.notebookDocumentSync?.notebookSelector ?? [];
        const scheme = notebook.uri.slice(0, Math.max(0, notebook.uri.indexOf(':')));
        return selectors.some(({ notebook: filter }) => {
            if (filter === undefined) {
                return true;
            }
            if (typeof filter === 'string') {
                return filter === '*' || filter === notebook.notebookType;
            }
            return (
                (!filter.notebookType || filter.notebookType === notebook.notebookType) &&
                (!filter.scheme || filter.scheme === scheme) &&
                (!filter.pattern || globMatch(decodeURIComponent(new URL(notebook.uri).pathname), filter.pattern))
            );
        });
    }

    /* Opens a notebook with the documents of its cells, which do not go through `openDocument`. */
    async openNotebook(notebook: NotebookDocument, cellTextDocuments: readonly DocumentItem[]): Promise<void> {
        if (this.syncsNotebook(notebook)) {
            await this.notify('notebookDocument/didOpen', {
                notebookDocument: notebook,
                cellTextDocuments: cellTextDocuments.map((item) => ({ ...item, version: item.version ?? 0 }))
            });
        }
    }

    async changeNotebook(notebook: Pick<NotebookDocument, 'uri' | 'notebookType' | 'version'>, change: NotebookDocumentChangeEvent): Promise<void> {
        if (this.syncsNotebook(notebook)) {
            await this.notify('notebookDocument/didChange', { notebookDocument: { uri: notebook.uri, version: notebook.version }, change });
        }
    }

    async saveNotebook(notebook: Pick<NotebookDocument, 'uri' | 'notebookType'>): Promise<void> {
        if (this.syncsNotebook(notebook) && this.serverCapabilities.notebookDocumentSync?.save === true) {
            await this.notify('notebookDocument/didSave', { notebookDocument: { uri: notebook.uri } });
        }
    }

    async closeNotebook(notebook: Pick<NotebookDocument, 'uri' | 'notebookType'>, cellUris: readonly string[]): Promise<void> {
        if (this.syncsNotebook(notebook)) {
            await this.notify('notebookDocument/didClose', {
                notebookDocument: { uri: notebook.uri },
                cellTextDocuments: cellUris.map((uri) => ({ uri }))
            });
        }
    }

    async setConfiguration(settings: Record<string, unknown>): Promise<void> {
        this.configuration = settings;
        await this.notify('workspace/didChangeConfiguration', { settings });
    }

    onRequest(method: string, handler: RequestHandler): Disposable {
        return this.connection.onRequest(method, handler);
    }

    onNotification(method: string, listener: (params: unknown) => void | Promise<void>): Disposable {
        return this.connection.onNotification(method, listener);
    }

    onError(listener: (error: Error) => void): Disposable {
        return this.connection.onError(listener);
    }

    onProgress(listener: (params: ProgressParams) => void): Disposable {
        return this.onNotification('$/progress', (params) => listener(params as ProgressParams));
    }

    onDiagnostics(listener: (params: PublishDiagnosticsParams) => void): Disposable {
        this.diagnosticListeners.add(listener);

        return {
            dispose: () => {
                this.diagnosticListeners.delete(listener);
            }
        };
    }

    /* What the server registered to hear about, which is nothing until it registers for `workspace/didChangeWatchedFiles`. */
    watchedFiles(): FileSystemWatcher[] {
        return [...this.registrations.values()]
            .filter((registration) => registration.method === 'workspace/didChangeWatchedFiles')
            .flatMap((registration) => registration.registerOptions?.watchers ?? []);
    }

    /* Tells the server which files changed on disk. The caller holds back what its patterns do not name. */
    didChangeWatchedFiles(changes: readonly FileEvent[]): Promise<void> {
        return this.notify('workspace/didChangeWatchedFiles', { changes });
    }

    /* The files a server asked to hear about when they are renamed, created or deleted, from its capabilities and its registrations. */
    fileOperationFilters(operation: FileOperation): FileOperationFilter[] {
        const fileOperations = (this.serverCapabilities.workspace as { fileOperations?: Record<string, ProviderOptions> } | undefined)?.fileOperations;
        const method = `workspace/${operation}Files`;

        return [
            ...(fileOperations?.[operation]?.filters ?? []),
            ...[...this.registrations.values()]
                .filter((registration) => registration.method === method)
                .flatMap((registration) => registration.registerOptions?.filters ?? [])
        ];
    }

    /* What the server would change before these files move, or null when it takes none of them or has nothing to say. */
    async willRenameFiles(files: readonly RenamedFile[], options?: RequestOptions): Promise<WorkspaceEdit | null> {
        return this.askBefore('willRename', renamesTaken(this.fileOperationFilters('willRename'), files), options);
    }

    /* Tells the server which of these files moved, those its filters take. */
    async didRenameFiles(files: readonly RenamedFile[]): Promise<void> {
        await this.tellAfter('didRename', renamesTaken(this.fileOperationFilters('didRename'), files));
    }

    /* What the server would change before these files are made, or null when it takes none of them or has nothing to say. */
    async willCreateFiles(files: readonly CreatedFile[], options?: RequestOptions): Promise<WorkspaceEdit | null> {
        return this.askBefore('willCreate', createsTaken(this.fileOperationFilters('willCreate'), files), options);
    }

    /* Tells the server which of these files were made, those its filters take. */
    async didCreateFiles(files: readonly CreatedFile[]): Promise<void> {
        await this.tellAfter('didCreate', createsTaken(this.fileOperationFilters('didCreate'), files));
    }

    /* What the server would change before these files are deleted, or null when it takes none of them or has nothing to say. */
    async willDeleteFiles(files: readonly DeletedFile[], options?: RequestOptions): Promise<WorkspaceEdit | null> {
        return this.askBefore('willDelete', deletesTaken(this.fileOperationFilters('willDelete'), files), options);
    }

    /* Tells the server which of these files were deleted, those its filters take. */
    async didDeleteFiles(files: readonly DeletedFile[]): Promise<void> {
        await this.tellAfter('didDelete', deletesTaken(this.fileOperationFilters('didDelete'), files));
    }

    /* Registrations and the refresh requests of the server both land here, since each can change what a document may ask. */
    onCapabilitiesChanged(listener: () => void): Disposable {
        this.capabilityListeners.add(listener);

        return {
            dispose: () => {
                this.capabilityListeners.delete(listener);
            }
        };
    }

    shutdown(): Promise<void> {
        this.shutdownPromise ??= this.stop();

        return this.shutdownPromise;
    }

    /* Called by a document that closed, so its diagnostics go with it. */
    forgetDocument(document: LspDocument): void {
        if (this.documents.get(fileUriKey(document.uri)) !== document) {
            return;
        }

        this.documents.delete(fileUriKey(document.uri));
        this.emitDiagnostics({ uri: document.uri, diagnostics: [] });
    }

    private assertReady(): void {
        if (this.phase !== 'ready') {
            throw new LspError(`LSP session is ${this.phase}; await initialize() first`, ErrorCodes.ServerNotInitialized);
        }
    }

    private async askBefore(
        operation: 'willRename' | 'willCreate' | 'willDelete',
        files: readonly object[],
        options?: RequestOptions
    ): Promise<WorkspaceEdit | null> {
        return files.length === 0 || this.phase !== 'ready' ? null : this.request<WorkspaceEdit | null>(`workspace/${operation}Files`, { files }, options);
    }

    private async tellAfter(operation: 'didRename' | 'didCreate' | 'didDelete', files: readonly object[]): Promise<void> {
        if (files.length > 0 && this.phase === 'ready') {
            await this.notify(`workspace/${operation}Files`, { files });
        }
    }

    private async stop(): Promise<void> {
        try {
            if (this.phase === 'initializing') {
                await this.initialized;
            }

            if (this.phase === 'ready') {
                this.phase = 'closing';
                await Promise.all([...this.documents.values()].map((document) => document.close()));
                await this.connection.request('shutdown', undefined, { timeoutMs: 5_000 });
                await this.connection.notify('exit');
            }
        } finally {
            await this.connection.close();
            this.phase = 'closed';
        }
    }

    private readConfiguration(section?: string): unknown {
        if (!section) {
            return this.configuration;
        }

        if (Object.hasOwn(this.configuration, section)) {
            return this.configuration[section];
        }

        let result: unknown = this.configuration;

        for (const key of section.split('.')) {
            if (!result || typeof result !== 'object' || !Object.hasOwn(result, key)) {
                return null;
            }

            result = (result as Record<string, unknown>)[key];
        }

        return result ?? null;
    }

    private emitDiagnostics(params: PublishDiagnosticsParams): void {
        this.emit(this.diagnosticListeners, params);
    }

    private emitCapabilities(): void {
        this.emit(this.capabilityListeners, undefined);
    }

    /* A listener that throws is reported and does not keep the others from hearing it. */
    private emit<T>(listeners: ReadonlySet<(value: T) => void>, value: T): void {
        for (const listener of listeners) {
            try {
                listener(value);
            } catch (error) {
                this.connection.reportError(error);
            }
        }
    }
}

function clientCapabilities(options: LspSessionOptions): object {
    const dynamic = { dynamicRegistration: true };
    const symbolKind = { valueSet: Array.from({ length: 26 }, (_, index) => index + 1) };

    return {
        general: {
            positionEncodings: ['utf-16'],
            staleRequestSupport: { cancel: true, retryOnContentModified: [] },
            regularExpressions: { engine: 'ECMAScript', version: 'ES2020' },
            markdown: { parser: 'remark', version: '15' }
        },
        notebookDocument: { synchronization: { dynamicRegistration: false, executionSummarySupport: true } },
        workspace: {
            applyEdit: !!options.onApplyEdit,
            workspaceEdit: { documentChanges: true, resourceOperations: [...(options.resourceOperations ?? ['create', 'rename'])], failureHandling: 'abort' },
            fileOperations: {
                dynamicRegistration: true,
                willRename: true,
                didRename: true,
                willCreate: true,
                didCreate: true,
                willDelete: true,
                didDelete: true
            },
            configuration: true,
            workspaceFolders: true,
            executeCommand: dynamic,
            didChangeWatchedFiles: { ...dynamic, relativePatternSupport: true },
            symbol: { ...dynamic, symbolKind, tagSupport: { valueSet: [1] }, resolveSupport: { properties: ['location.range'] } },
            semanticTokens: { refreshSupport: true },
            inlayHint: { refreshSupport: true },
            codeLens: { refreshSupport: true },
            diagnostics: { refreshSupport: true },
            inlineValue: { refreshSupport: true },
            foldingRange: { refreshSupport: true },
            textDocumentContent: { dynamicRegistration: false }
        },
        window: {
            workDoneProgress: true,
            showMessage: { messageActionItem: { additionalPropertiesSupport: false } },
            showDocument: { support: !!options.onShowDocument }
        },
        textDocument: {
            synchronization: { dynamicRegistration: false, willSave: true, willSaveWaitUntil: true, didSave: true },
            publishDiagnostics: {
                versionSupport: true,
                relatedInformation: true,
                tagSupport: { valueSet: [1, 2] },
                codeDescriptionSupport: true,
                dataSupport: true
            },
            completion: {
                ...dynamic,
                contextSupport: true,
                insertTextMode: 1,
                completionItemKind: { valueSet: Array.from({ length: 25 }, (_, index) => index + 1) },
                ...(options.completionItemDefaults?.length ? { completionList: { itemDefaults: [...options.completionItemDefaults] } } : {}),
                completionItem: {
                    snippetSupport: options.snippetSupport ?? false,
                    ...(options.insertTextModes?.length ? { insertTextModeSupport: { valueSet: [...options.insertTextModes] } } : {}),
                    commitCharactersSupport: true,
                    documentationFormat: ['markdown', 'plaintext'],
                    deprecatedSupport: true,
                    tagSupport: { valueSet: [1] },
                    preselectSupport: true,
                    insertReplaceSupport: true,
                    labelDetailsSupport: true,
                    resolveSupport: { properties: ['documentation', 'detail', 'additionalTextEdits', 'command'] }
                }
            },
            hover: { ...dynamic, contentFormat: ['markdown', 'plaintext'] },
            signatureHelp: {
                ...dynamic,
                contextSupport: true,
                signatureInformation: {
                    documentationFormat: ['markdown', 'plaintext'],
                    parameterInformation: { labelOffsetSupport: true },
                    activeParameterSupport: true
                }
            },
            definition: { ...dynamic, linkSupport: true },
            declaration: { ...dynamic, linkSupport: true },
            typeDefinition: { ...dynamic, linkSupport: true },
            implementation: { ...dynamic, linkSupport: true },
            references: dynamic,
            documentHighlight: dynamic,
            documentSymbol: { ...dynamic, symbolKind, hierarchicalDocumentSymbolSupport: true, tagSupport: { valueSet: [1] }, labelSupport: true },
            rename: { ...dynamic, prepareSupport: true, prepareSupportDefaultBehavior: 1 },
            codeAction: {
                ...dynamic,
                dataSupport: true,
                isPreferredSupport: true,
                disabledSupport: true,
                codeActionLiteralSupport: {
                    codeActionKind: {
                        valueSet: [
                            '',
                            'quickfix',
                            'refactor',
                            'refactor.extract',
                            'refactor.inline',
                            'refactor.rewrite',
                            'refactor.move',
                            'source',
                            'source.organizeImports',
                            'source.fixAll'
                        ]
                    }
                },
                resolveSupport: { properties: ['edit', 'command'] }
            },
            codeLens: { ...dynamic, resolveSupport: { properties: ['command'] } },
            formatting: dynamic,
            rangeFormatting: { ...dynamic, rangesSupport: true },
            onTypeFormatting: dynamic,
            foldingRange: {
                ...dynamic,
                lineFoldingOnly: false,
                foldingRangeKind: { valueSet: ['comment', 'imports', 'region'] },
                foldingRange: { collapsedText: false }
            },
            documentLink: { ...dynamic, tooltipSupport: true },
            colorProvider: dynamic,
            linkedEditingRange: dynamic,
            moniker: dynamic,
            typeHierarchy: dynamic,
            inlineValue: dynamic,
            inlineCompletion: dynamic,
            selectionRange: dynamic,
            semanticTokens: {
                ...dynamic,
                requests: { range: true, full: { delta: true } },
                tokenTypes: [
                    'namespace',
                    'type',
                    'class',
                    'enum',
                    'interface',
                    'struct',
                    'typeParameter',
                    'parameter',
                    'variable',
                    'property',
                    'enumMember',
                    'event',
                    'function',
                    'method',
                    'macro',
                    'keyword',
                    'modifier',
                    'comment',
                    'string',
                    'number',
                    'regexp',
                    'operator',
                    'decorator'
                ],
                tokenModifiers: [
                    'declaration',
                    'definition',
                    'readonly',
                    'static',
                    'deprecated',
                    'abstract',
                    'async',
                    'modification',
                    'documentation',
                    'defaultLibrary'
                ],
                formats: ['relative'],
                overlappingTokenSupport: false,
                multilineTokenSupport: false
            },
            inlayHint: { ...dynamic, resolveSupport: { properties: ['tooltip', 'textEdits', 'label.tooltip', 'label.location', 'label.command'] } },
            callHierarchy: { dynamicRegistration: false },
            diagnostic: { ...dynamic, relatedDocumentSupport: true }
        }
    };
}
