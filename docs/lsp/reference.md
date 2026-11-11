# Reference

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

## `@adecore/lsp`

The client, the edit helpers, the transports and the `LanguageService` contract.

<ExportTable entry="@adecore/lsp" />

Most of the types in the table are the protocol's own shapes. They follow LSP 3.17 and the 3.18 additions the client announces, and most carry the specification's names. `ContentChange` is its `TextDocumentContentChangeEvent`, `DocumentItem` its `TextDocumentItem`, and `ProviderOptions` the options of a registration. Grouped as the specification groups them:

- Base protocol: `RequestId`, `RpcRequest`, `RpcNotification`, `RpcResponse`, `RpcMessage`, `ProgressToken`, `ProgressParams`, `WorkDoneProgress`, `TraceValue`, `LogTraceParams`.
- Basic structures: `Position`, `Range`, `Location`, `LocationLink`, `TextEdit`, `InsertReplaceEdit`, `TextDocumentEdit`, `CreateFile`, `RenameFile`, `DeleteFile`, `WorkspaceEdit`, `Diagnostic`, `Command`, `MarkupContent`, `MarkedString`, `DocumentFilter`, `DocumentItem`.
- Lifecycle: `InitializeResult`, `ServerCapabilities`, `TextDocumentSyncOptions`, `Registration`, `ProviderOptions`.
- Document synchronization: `ContentChange`, `TextDocumentSaveReason`, `NotebookDocument`, `NotebookCell`, `NotebookCellArrayChange`, `NotebookDocumentChangeEvent`, `NotebookDocumentFilter`, `NotebookDocumentSyncOptions`.
- Language features: `CompletionContext`, `CompletionItem`, `CompletionList`, `CompletionResult`, `Hover`, `SignatureHelp`, `SignatureHelpContext`, `SignatureInformation`, `ParameterInformation`, `NavigationResult`, `DocumentHighlight`, `DocumentSymbol`, `DocumentSymbolResult`, `SymbolInformation`, `SymbolKind`, `CallHierarchyItem`, `CallHierarchyIncomingCall`, `CallHierarchyOutgoingCall`, `TypeHierarchyItem`, `CodeAction`, `CodeActionContext`, `CodeLens`, `DocumentLink`, `Color`, `ColorInformation`, `ColorPresentation`, `FormattingOptions`, `PrepareRenameResult`, `LinkedEditingRanges`, `Moniker`, `MonikerKind`, `UniquenessLevel`, `FoldingRange`, `SelectionRange`, `SemanticTokens`, `SemanticTokensDelta`, `SemanticTokensLegend`, `InlayHint`, `InlayHintLabelPart`, `InlineValue`, `InlineValueContext`, `InlineCompletionContext`, `InlineCompletionItem`, `InlineCompletionResult`, `PublishDiagnosticsParams`, `DocumentDiagnosticReport`, `PreviousResultId`.
- Workspace features: `WorkspaceFolder`, `WorkspaceFoldersChangeEvent`, `ConfigurationItem`, `WorkspaceSymbol`, `WorkspaceSymbolResult`, `FileEvent`, `FileSystemWatcher`, `FileOperation`, `FileOperationFilter`, `FileCreate`, `FileRename`, `FileDelete`, `ApplyWorkspaceEditParams`, `ApplyWorkspaceEditResult`, `WorkspaceDiagnosticReport`, `WorkspaceDocumentDiagnosticReport`, `TextDocumentContentResult`.
- Window features: `ShowMessageParams`, `ShowMessageRequestParams`, `MessageActionItem`, `MessageType`, `LogMessageParams`, `ShowDocumentParams`, `ShowDocumentResult`.

`LspTransport`, `Disposable`, `RequestOptions` and `DocumentRequestOptions` belong to this package, not to the specification. See [Transports](/lsp/transports) and [Sessions](/lsp/sessions).

## `@adecore/lsp/testing`

A language server for tests and the memory transport. See [Testing](/lsp/testing).

<ExportTable entry="@adecore/lsp/testing" />
