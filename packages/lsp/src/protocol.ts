export interface Disposable {
    dispose(): void;
}

export type RequestId = number | string;

export interface RpcRequest {
    jsonrpc: '2.0';
    id: RequestId;
    method: string;
    params?: unknown;
}

export interface RpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}

export interface RpcResponse {
    jsonrpc: '2.0';
    id: RequestId | null;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

export type RpcMessage = RpcRequest | RpcNotification | RpcResponse;

/*
 * What a connection speaks over. A message arrives parsed and is not validated yet, since the
 * connection is the one that knows what a valid one looks like.
 */
export interface LspTransport {
    send(message: RpcMessage): void | Promise<void>;
    onMessage(listener: (message: unknown) => void): Disposable;
    onClose(listener: (error?: Error) => void): Disposable;
    close(): void | Promise<void>;
}

export interface RequestOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    /*
     * Asks the server to stream the result: each part arrives here before the answer, which then holds only what
     * is left, often nothing. The caller joins the parts, since how depends on the method. Needs object params.
     */
    onPartialResult?: (value: unknown) => void;
    /* Asks the server to report the progress of the work under a token of the client. Needs object params. */
    onWorkDoneProgress?: (progress: WorkDoneProgress) => void;
}

export interface DocumentRequestOptions extends RequestOptions {
    /* A newer request for the same feature of the same document cancels this one. On unless `false`. */
    cancelPrevious?: boolean;
}

/* Zero-based, and a character counts UTF-16 code units. */
export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface Location {
    uri: string;
    range: Range;
}

export interface LocationLink {
    originSelectionRange?: Range;
    targetUri: string;
    targetRange: Range;
    targetSelectionRange: Range;
}

export type NavigationResult = Location | Location[] | LocationLink[] | null;

export interface TextEdit {
    range: Range;
    newText: string;
    annotationId?: string;
}

/* One entry of `didChange`: a replacement of a range, or without a range the whole text. */
export interface ContentChange {
    range?: Range;
    text: string;
}

export interface InsertReplaceEdit {
    newText: string;
    insert: Range;
    replace: Range;
}

export interface MarkupContent {
    kind: 'plaintext' | 'markdown';
    value: string;
}

export type MarkedString = string | { language: string; value: string };

export interface Command {
    title: string;
    command: string;
    arguments?: unknown[];
}

export interface Diagnostic {
    range: Range;
    message: string;
    severity?: 1 | 2 | 3 | 4;
    code?: number | string;
    codeDescription?: { href: string };
    source?: string;
    tags?: number[];
    relatedInformation?: { location: Location; message: string }[];
    data?: unknown;
}

export interface PublishDiagnosticsParams {
    uri: string;
    version?: number;
    diagnostics: Diagnostic[];
}

export interface CompletionContext {
    triggerKind: 1 | 2 | 3;
    triggerCharacter?: string;
}

export interface CompletionItem {
    label: string;
    labelDetails?: { detail?: string; description?: string };
    kind?: number;
    tags?: number[];
    detail?: string;
    documentation?: string | MarkupContent;
    deprecated?: boolean;
    preselect?: boolean;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: 1 | 2;
    insertTextMode?: 1 | 2;
    textEdit?: TextEdit | InsertReplaceEdit;
    textEditText?: string;
    additionalTextEdits?: TextEdit[];
    commitCharacters?: string[];
    command?: Command;
    data?: unknown;
    [extension: string]: unknown;
}

export interface CompletionList {
    isIncomplete: boolean;
    items: CompletionItem[];
    itemDefaults?: {
        commitCharacters?: string[];
        editRange?: Range | { insert: Range; replace: Range };
        insertTextFormat?: 1 | 2;
        insertTextMode?: 1 | 2;
        data?: unknown;
    };
}

export type CompletionResult = CompletionItem[] | CompletionList | null;

export interface Hover {
    contents: MarkupContent | MarkedString | MarkedString[];
    range?: Range;
}

export interface DocumentHighlight {
    range: Range;
    kind?: 1 | 2 | 3;
}

export type SymbolKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26;

export interface DocumentSymbol {
    name: string;
    detail?: string;
    kind: SymbolKind;
    tags?: 1[];
    deprecated?: boolean;
    range: Range;
    selectionRange: Range;
    children?: DocumentSymbol[];
}

export interface SymbolInformation {
    name: string;
    kind: SymbolKind;
    tags?: 1[];
    deprecated?: boolean;
    location: Location;
    containerName?: string;
}

export interface WorkspaceSymbol {
    name: string;
    kind: SymbolKind;
    tags?: 1[];
    containerName?: string;
    location: Location | { uri: string };
    data?: unknown;
}

/* A function, method or class that calls are traced through; `data` is the server's own and goes back to it untouched. */
export interface CallHierarchyItem {
    name: string;
    kind: SymbolKind;
    tags?: 1[];
    detail?: string;
    uri: string;
    range: Range;
    selectionRange: Range;
    data?: unknown;
}

/* A caller of an item. `fromRanges` are the call sites, in the file of `from`. */
export interface CallHierarchyIncomingCall {
    from: CallHierarchyItem;
    fromRanges: Range[];
}

/* An item that another one calls. `fromRanges` are the call sites, in the file of the item that was asked about. */
export interface CallHierarchyOutgoingCall {
    to: CallHierarchyItem;
    fromRanges: Range[];
}

export type DocumentSymbolResult = DocumentSymbol[] | SymbolInformation[] | null;
export type WorkspaceSymbolResult = SymbolInformation[] | WorkspaceSymbol[] | null;

export interface ParameterInformation {
    label: string | [number, number];
    documentation?: string | MarkupContent;
}

export interface SignatureInformation {
    label: string;
    documentation?: string | MarkupContent;
    parameters?: ParameterInformation[];
    activeParameter?: number;
}

export interface SignatureHelp {
    signatures: SignatureInformation[];
    activeSignature?: number;
    activeParameter?: number;
}

export interface SignatureHelpContext {
    triggerKind: 1 | 2 | 3;
    triggerCharacter?: string;
    isRetrigger: boolean;
    activeSignatureHelp?: SignatureHelp;
}

export type PrepareRenameResult = Range | { range: Range; placeholder: string } | { defaultBehavior: boolean } | null;

export interface TextDocumentEdit {
    textDocument: { uri: string; version: number | null };
    edits: TextEdit[];
}

export interface CreateFile {
    kind: 'create';
    uri: string;
    options?: { overwrite?: boolean; ignoreIfExists?: boolean };
    annotationId?: string;
}

export interface RenameFile {
    kind: 'rename';
    oldUri: string;
    newUri: string;
    options?: { overwrite?: boolean; ignoreIfExists?: boolean };
    annotationId?: string;
}

export interface DeleteFile {
    kind: 'delete';
    uri: string;
    options?: { recursive?: boolean; ignoreIfNotExists?: boolean };
    annotationId?: string;
}

export interface WorkspaceEdit {
    changes?: Record<string, TextEdit[]>;
    documentChanges?: (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[];
    changeAnnotations?: Record<string, { label: string; needsConfirmation?: boolean; description?: string }>;
}

/* One entry of `workspace/willRenameFiles` and `didRenameFiles`. */
export interface FileRename {
    oldUri: string;
    newUri: string;
}

/* One entry of `workspace/willCreateFiles` and `didCreateFiles`. */
export interface FileCreate {
    uri: string;
}

/* One entry of `workspace/willDeleteFiles` and `didDeleteFiles`. */
export interface FileDelete {
    uri: string;
}

/* The file operations a server can ask to hear about, each in a `will` form that may answer with an edit and a `did` form that only informs. */
export type FileOperation = 'willRename' | 'didRename' | 'willCreate' | 'didCreate' | 'willDelete' | 'didDelete';

export interface FileOperationFilter {
    scheme?: string;
    pattern: { glob: string; matches?: 'file' | 'folder'; options?: { ignoreCase?: boolean } };
}

export interface ApplyWorkspaceEditParams {
    label?: string;
    edit: WorkspaceEdit;
}

export interface ApplyWorkspaceEditResult {
    applied: boolean;
    failureReason?: string;
    failedChange?: number;
}

export interface CodeAction {
    title: string;
    kind?: string;
    diagnostics?: Diagnostic[];
    isPreferred?: boolean;
    disabled?: { reason: string };
    edit?: WorkspaceEdit;
    command?: Command;
    data?: unknown;
    [extension: string]: unknown;
}

export interface CodeActionContext {
    diagnostics: Diagnostic[];
    only?: string[];
    triggerKind?: 1 | 2;
}

export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
    trimTrailingWhitespace?: boolean;
    insertFinalNewline?: boolean;
    trimFinalNewlines?: boolean;
    [key: string]: boolean | number | string | undefined;
}

export interface SemanticTokens {
    resultId?: string;
    data: number[];
}

export interface SemanticTokensDelta {
    resultId?: string;
    edits: { start: number; deleteCount: number; data?: number[] }[];
}

export interface SemanticTokensLegend {
    tokenTypes: string[];
    tokenModifiers: string[];
}

export interface InlayHintLabelPart {
    value: string;
    tooltip?: string | MarkupContent;
    location?: Location;
    command?: Command;
}

export interface InlayHint {
    position: Position;
    label: string | InlayHintLabelPart[];
    kind?: 1 | 2;
    textEdits?: TextEdit[];
    tooltip?: string | MarkupContent;
    paddingLeft?: boolean;
    paddingRight?: boolean;
    data?: unknown;
    [extension: string]: unknown;
}

export interface FoldingRange {
    startLine: number;
    startCharacter?: number;
    endLine: number;
    endCharacter?: number;
    kind?: string;
    collapsedText?: string;
}

/* One link of a chain that grows from the smallest range around a position to the whole document. */
export interface SelectionRange {
    range: Range;
    parent?: SelectionRange;
}

export interface CodeLens {
    range: Range;
    command?: Command;
    data?: unknown;
}

export type DocumentDiagnosticReport =
    | { kind: 'full'; resultId?: string; items: Diagnostic[]; relatedDocuments?: Record<string, DocumentDiagnosticReport> }
    | { kind: 'unchanged'; resultId: string; relatedDocuments?: Record<string, DocumentDiagnosticReport> };

export interface DocumentFilter {
    language?: string;
    scheme?: string;
    pattern?: string;
}

/* What a server asks to hear about: a glob relative to the project, or one relative to a folder. `kind` is a bit set of create (1), change (2) and delete (4), all three when absent. */
export interface FileSystemWatcher {
    globPattern: string | { baseUri: string | WorkspaceFolder; pattern: string };
    kind?: number;
}

export interface FileEvent {
    uri: string;
    type: 1 | 2 | 3;
}

export interface Registration {
    id: string;
    method: string;
    registerOptions?: ProviderOptions;
}

export interface ProviderOptions {
    documentSelector?: DocumentFilter[] | null;
    resolveProvider?: boolean;
    prepareProvider?: boolean;
    triggerCharacters?: string[];
    /* Of on type formatting: the first character that asks, and the others that do. */
    firstTriggerCharacter?: string;
    moreTriggerCharacter?: string[];
    retriggerCharacters?: string[];
    commands?: string[];
    watchers?: FileSystemWatcher[];
    codeActionKinds?: string[];
    legend?: SemanticTokensLegend;
    /* Of a file operation registration. */
    filters?: FileOperationFilter[];
    range?: boolean | object;
    full?: boolean | { delta?: boolean };
    /* Of a formatting registration: the server formats several ranges in one request. */
    rangesSupport?: boolean;
    /* Of a diagnostic registration: the server answers `workspace/diagnostic`. */
    workspaceDiagnostics?: boolean;
    /* Of a `workspace/textDocumentContent` registration. */
    schemes?: string[];
    [option: string]: unknown;
}

export interface TextDocumentSyncOptions {
    openClose?: boolean;
    change?: 0 | 1 | 2;
    willSave?: boolean;
    willSaveWaitUntil?: boolean;
    save?: boolean | { includeText?: boolean };
}

export interface ServerCapabilities {
    positionEncoding?: string;
    textDocumentSync?: 0 | 1 | 2 | TextDocumentSyncOptions;
    completionProvider?: ProviderOptions;
    hoverProvider?: boolean | ProviderOptions;
    signatureHelpProvider?: ProviderOptions;
    definitionProvider?: boolean | ProviderOptions;
    declarationProvider?: boolean | ProviderOptions;
    typeDefinitionProvider?: boolean | ProviderOptions;
    implementationProvider?: boolean | ProviderOptions;
    referencesProvider?: boolean | ProviderOptions;
    documentHighlightProvider?: boolean | ProviderOptions;
    documentSymbolProvider?: boolean | ProviderOptions;
    workspaceSymbolProvider?: boolean | ProviderOptions;
    renameProvider?: boolean | ProviderOptions;
    codeActionProvider?: boolean | ProviderOptions;
    codeLensProvider?: ProviderOptions;
    executeCommandProvider?: ProviderOptions;
    documentFormattingProvider?: boolean | ProviderOptions;
    documentRangeFormattingProvider?: boolean | ProviderOptions;
    foldingRangeProvider?: boolean | ProviderOptions;
    selectionRangeProvider?: boolean | ProviderOptions;
    semanticTokensProvider?: ProviderOptions & { legend: SemanticTokensLegend };
    inlayHintProvider?: boolean | ProviderOptions;
    callHierarchyProvider?: boolean | ProviderOptions;
    documentOnTypeFormattingProvider?: ProviderOptions;
    diagnosticProvider?: ProviderOptions & { interFileDependencies?: boolean; workspaceDiagnostics?: boolean };
    documentLinkProvider?: ProviderOptions;
    colorProvider?: boolean | ProviderOptions;
    linkedEditingRangeProvider?: boolean | ProviderOptions;
    monikerProvider?: boolean | ProviderOptions;
    typeHierarchyProvider?: boolean | ProviderOptions;
    inlineValueProvider?: boolean | ProviderOptions;
    inlineCompletionProvider?: boolean | ProviderOptions;
    notebookDocumentSync?: NotebookDocumentSyncOptions;
    workspace?: {
        workspaceFolders?: { supported?: boolean; changeNotifications?: boolean | string };
        fileOperations?: Partial<Record<FileOperation, { filters: FileOperationFilter[] }>>;
        textDocumentContent?: { schemes: string[] };
    };
    [capability: string]: unknown;
}

export interface InitializeResult {
    capabilities: ServerCapabilities;
    serverInfo?: { name: string; version?: string };
}

export interface WorkspaceFolder {
    uri: string;
    name: string;
}

export interface DocumentItem {
    uri: string;
    languageId: string;
    text: string;
    version?: number;
}

export interface ConfigurationItem {
    scopeUri?: string;
    section?: string;
}

export interface ProgressParams {
    token: string | number;
    value: unknown;
}

export type ProgressToken = string | number;

/* The values of `$/progress` for a work-done token: a begin, any number of reports, and an end. */
export type WorkDoneProgress =
    | { kind: 'begin'; title: string; cancellable?: boolean; message?: string; percentage?: number }
    | { kind: 'report'; cancellable?: boolean; message?: string; percentage?: number }
    | { kind: 'end'; message?: string };

export type TraceValue = 'off' | 'messages' | 'verbose';

export interface LogTraceParams {
    message: string;
    verbose?: string;
}

/* 1 error, 2 warning, 3 info, 4 log, 5 debug (3.18). */
export type MessageType = 1 | 2 | 3 | 4 | 5;

export interface ShowMessageParams {
    type: MessageType;
    message: string;
}

export interface MessageActionItem {
    title: string;
    [property: string]: unknown;
}

export interface ShowMessageRequestParams extends ShowMessageParams {
    actions?: MessageActionItem[];
}

export interface LogMessageParams {
    type: MessageType;
    message: string;
}

/* A document or a web address a server asks to have shown; `external` opens it outside the editor. */
export interface ShowDocumentParams {
    uri: string;
    external?: boolean;
    takeFocus?: boolean;
    selection?: Range;
}

export interface ShowDocumentResult {
    success: boolean;
}

export interface WorkspaceFoldersChangeEvent {
    added: WorkspaceFolder[];
    removed: WorkspaceFolder[];
}

/* 1 when a person saved, 2 after a delay, 3 when the editor lost focus. */
export type TextDocumentSaveReason = 1 | 2 | 3;

export interface DocumentLink {
    range: Range;
    target?: string;
    tooltip?: string;
    data?: unknown;
}

/* Each part from 0 to 1. */
export interface Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

export interface ColorInformation {
    range: Range;
    color: Color;
}

/* One way to write a color: its label is what the picker shows, `textEdit` what replaces the color in the text. */
export interface ColorPresentation {
    label: string;
    textEdit?: TextEdit;
    additionalTextEdits?: TextEdit[];
}

/* Ranges that are edited together, such as the names of a start and an end tag; `wordPattern` limits what they may become. */
export interface LinkedEditingRanges {
    ranges: Range[];
    wordPattern?: string;
}

export type UniquenessLevel = 'document' | 'project' | 'group' | 'scheme' | 'global';
export type MonikerKind = 'import' | 'export' | 'local';

export interface Moniker {
    scheme: string;
    identifier: string;
    unique: UniquenessLevel;
    kind?: MonikerKind;
}

/* A class, interface or other type whose super and sub types are traced; `data` goes back to the server untouched. */
export interface TypeHierarchyItem {
    name: string;
    kind: SymbolKind;
    tags?: 1[];
    detail?: string;
    uri: string;
    range: Range;
    selectionRange: Range;
    data?: unknown;
}

/* Where a debugger stopped, which a server reads inline values for. */
export interface InlineValueContext {
    frameId: number;
    stoppedLocation: Range;
}

export type InlineValue =
    | { range: Range; text: string }
    | { range: Range; variableName?: string; caseSensitiveLookup: boolean }
    | { range: Range; expression?: string };

/* 1 when a person asked, 2 while typing. */
export interface InlineCompletionContext {
    triggerKind: 1 | 2;
    selectedCompletionInfo?: { range: Range; text: string };
}

export interface InlineCompletionItem {
    insertText: string | { kind: 'snippet'; value: string };
    filterText?: string;
    range?: Range;
    command?: Command;
}

export type InlineCompletionResult = InlineCompletionItem[] | { items: InlineCompletionItem[] } | null;

export type WorkspaceDocumentDiagnosticReport =
    | { kind: 'full'; uri: string; version: number | null; resultId?: string; items: Diagnostic[] }
    | { kind: 'unchanged'; uri: string; version: number | null; resultId: string };

export interface WorkspaceDiagnosticReport {
    items: WorkspaceDocumentDiagnosticReport[];
}

/* What the client last heard for a document, so the server can answer `unchanged`. */
export interface PreviousResultId {
    uri: string;
    value: string;
}

export interface TextDocumentContentResult {
    text: string;
}

export interface NotebookCell {
    /* 1 markup, 2 code. */
    kind: 1 | 2;
    document: string;
    metadata?: Record<string, unknown>;
    executionSummary?: { executionOrder: number; success?: boolean };
}

export interface NotebookDocument {
    uri: string;
    notebookType: string;
    version: number;
    metadata?: Record<string, unknown>;
    cells: NotebookCell[];
}

export interface NotebookCellArrayChange {
    start: number;
    deleteCount: number;
    cells?: NotebookCell[];
}

export interface NotebookDocumentChangeEvent {
    metadata?: Record<string, unknown>;
    cells?: {
        structure?: { array: NotebookCellArrayChange; didOpen?: DocumentItem[]; didClose?: { uri: string }[] };
        data?: NotebookCell[];
        textContent?: { document: { uri: string; version: number }; changes: ContentChange[] }[];
    };
}

export interface NotebookDocumentFilter {
    notebookType?: string;
    scheme?: string;
    pattern?: string;
}

export interface NotebookDocumentSyncOptions {
    notebookSelector: { notebook?: string | NotebookDocumentFilter; cells?: { language: string }[] }[];
    save?: boolean;
}
