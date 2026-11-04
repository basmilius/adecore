# Reference

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

## `@adecore/lsp`

The client, the edit helpers, the transports and the `LanguageService` contract.

<ExportTable entry="@adecore/lsp" />

The entry also exports every type of `src/protocol.ts` with `export type *`, which the table leaves out: the protocol shapes such as `Position`, `Range`, `TextEdit`, `ContentChange`, `Diagnostic`, `WorkspaceEdit`, `ServerCapabilities` and `LspTransport`. They follow the LSP specification of the same names.

## `@adecore/lsp/testing`

A language server for tests and the memory transport. See [Testing](/lsp/testing).

<ExportTable entry="@adecore/lsp/testing" />
