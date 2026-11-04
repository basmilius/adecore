# Documents and requests

## LspDocument

`session.openDocument(item)` sends `didOpen` and returns the `LspDocument` that owns the text and version from then on. `item` has a `uri`, a `languageId`, the `text` and an optional `version` (default `1`). A URI can be open once per session, and `session.getDocument(uri)` returns it. Await `document.ready` before relying on the server having it.

`updateText(text)` sends the one range that differs, or nothing. `applyChanges(changes)` sends `didChange` entries in order, each relative to the text the previous one left. Both raise the version by one and resolve once the text is sent. A full-sync server gets the whole text after a pause of `fullSyncDelayMs` (see [sessions](/lsp/sessions)), and at once before a request, `save()` or `close()`.

`save()` sends `didSave` if the server asked for it. It writes no file, so call it after the app saved. `close()` cancels pending work, sends `didClose` and clears the document's diagnostics. A second call does nothing.

Everything goes out in the order it was called.

## Requests

`LspDocument` has a method per feature, each with the position or range it needs and optional `DocumentRequestOptions`:

| Feature               | Methods                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Completion            | `completion`, `resolveCompletion`                                                                |
| Information           | `hover`, `signatureHelp`                                                                         |
| Navigation            | `definition`, `declaration`, `typeDefinition`, `implementation`                                  |
| Uses                  | `references`, `documentHighlights`                                                               |
| Symbols and structure | `documentSymbols`, `foldingRanges`, `selectionRanges`, `codeLenses`, `resolveCodeLens`           |
| Call hierarchy        | `prepareCallHierarchy`, `incomingCalls`, `outgoingCalls`                                         |
| Rename                | `prepareRename`, `rename`                                                                        |
| Actions               | `codeActions`, `resolveCodeAction`                                                               |
| Formatting            | `formatting`, `rangeFormatting`, `onTypeFormatting`                                              |
| Colors and hints      | `semanticTokens`, `semanticTokensDelta`, `semanticTokensRange`, `inlayHints`, `resolveInlayHint` |
| Diagnostics           | `diagnostics`, the pull model                                                                    |
| Type hierarchy        | `prepareTypeHierarchy`, `supertypes`, `subtypes`                                                 |
| Links and colors      | `documentLinks`, `resolveDocumentLink`, `documentColors`, `colorPresentations`                   |
| Editing together      | `linkedEditingRanges`                                                                            |
| Suggestions           | `inlineCompletions`                                                                              |
| Formatting ranges     | `rangesFormatting`, for a server that sets `rangesSupport`                                       |
| Indexing and debugging | `monikers`, `inlineValues`                                                                      |
| Saving                | `willSave(reason?)`, `willSaveWaitUntil(reason?)`, then `save()` once the file is written         |

`incomingCalls(item)` and `outgoingCalls(item)` take a `CallHierarchyItem` from `prepareCallHierarchy(position)`, with its `data` untouched. `supertypes(item)` and `subtypes(item)` take a `TypeHierarchyItem` from `prepareTypeHierarchy(position)`. These four run side by side by default, so expanding two tree nodes does not cancel the first. Pass `cancelPrevious: true` to change that.

`willSave` sends nothing and `willSaveWaitUntil` returns `null` unless the server asked for them in `textDocumentSync`. Apply the edits `willSaveWaitUntil` returns before writing the file.

`onTypeFormatting(position, ch, formatting)` runs after typing `ch` with the caret at `position`. The trigger characters are `firstTriggerCharacter` and `moreTriggerCharacter` in the `documentOnTypeFormattingProvider` options that `providerOptions` returns.

`request(method, params, options?)` sends any other document method, with the same guards.

A request can stream its answer. `onPartialResult` adds a `partialResultToken`, and each part arrives in the callback before the final answer, which holds the rest. Joining the parts is up to the caller. `onWorkDoneProgress` adds a `workDoneToken` and receives the request's `WorkDoneProgress`.

The guards:

- A method the server does not support rejects with `MethodNotFound` before anything is sent.
- A new request of a method cancels the previous one, unless `cancelPrevious` is `false`.
- A change or a close cancels all requests.
- An answer that arrives after the text changed rejects with `StaleResultError`.
- A completion item, code action, lens or hint resolves only for the version it came from.
- `signal` and `timeoutMs` cancel a request from outside.

To apply what a request returns, such as the edits of `formatting` or `rename`, see [Edits](/lsp/edits).

