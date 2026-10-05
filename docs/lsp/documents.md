# Documents and edits

## LspDocument

`session.openDocument(item)` sends `didOpen` and returns the `LspDocument` that owns the document's text and version from then on. `item` has a `uri`, a `languageId`, the `text` and an optional `version`, `1` by default. A URI can be open once per session; `session.getDocument(uri)` returns it. Wait for `document.ready` before you count on the server having it.

`updateText(text)` sends the one range that differs from the text the document holds, and nothing when it is the same. `applyChanges(changes)` sends `didChange` entries in order, each in the text the entry before it left. Both raise the version by one. A server that negotiated full sync gets the whole new text instead of the ranges.

`save()` sends `didSave` when the server asked for it, with the text when it asked for that too. It writes no file: call it after the app saved. `close()` cancels what is pending, sends `didClose` and clears the document's diagnostics; calling it again does nothing.

Opening, changes, requests, saving and closing go out in the order they were made.

## Requests

`LspDocument` has a method per feature, each with the position or range it needs and optional `DocumentRequestOptions`:

| Feature               | Methods                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Completion            | `completion`, `resolveCompletion`                                                          |
| Information           | `hover`, `signatureHelp`                                                                   |
| Navigation            | `definition`, `declaration`, `typeDefinition`, `implementation`                            |
| Uses                  | `references`, `documentHighlights`                                                         |
| Symbols and structure | `documentSymbols`, `foldingRanges`, `selectionRanges`, `codeLenses`, `resolveCodeLens`     |
| Rename                | `prepareRename`, `rename`                                                                  |
| Actions               | `codeActions`, `resolveCodeAction`                                                         |
| Formatting            | `formatting`, `rangeFormatting`                                                            |
| Colors and hints      | `semanticTokens`, `semanticTokensDelta`, `semanticTokensRange`, `inlayHints`, `resolveInlayHint` |
| Diagnostics           | `diagnostics`, the pull model                                                              |

`request(method, params, options?)` sends any other method of a document, with the same guards.

A method the server does not support rejects with `MethodNotFound` before anything is sent. A new request of a method cancels the one before it, unless `cancelPrevious` is `false`. A change or a close cancels all of them. An answer that arrives after the text changed rejects with `StaleResultError`, also when the server ignored the cancel. A completion item, code action, lens or hint resolves only for the version it came from. `signal` and `timeoutMs` in the options cancel a request from outside.

## Edit helpers

The protocol has two shapes of edit, and mixing them up gives wrong text:

| Shape                                  | Ranges are in                              | Helper                                |
| -------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `ContentChange`, as in `didChange`     | The text the change before it left         | `applyContentChanges(text, changes)`  |
| `TextEdit`, as in formatting or rename | The text before all of them, at once       | `applyTextEdits(text, edits)`         |

```ts
import { applyContentChanges, applyTextEdits, minimalChange } from '@adecore/lsp';

const after = applyTextEdits('red blue red', [
    { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: 'green' },
    { range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }, newText: 'green' }
]);
// 'green blue green'

applyContentChanges('red blue red', [minimalChange('red blue red', after)]) === after; // true
```

`applyTextEdits` rejects edits that overlap; several insertions at one position keep their order. `minimalChange(before, after)` is the one `ContentChange` between two texts, never splitting a surrogate pair or a `\r\n`. `offsetAt`, `positionAt` and `endPosition` convert between offsets and positions and throw on a position outside the text instead of clamping.

## Workspace edits

`planWorkspaceEdit(edit, snapshots)` works out a `WorkspaceEdit` in memory without applying it. `snapshots` maps each URI to a `DocumentSnapshot`, its `text` and `version` (or `null`). The result is a `PlannedDocumentEdit` per document: `uri`, `version`, the text `before` and the planned `text`. It throws an `LspError` for a document without a snapshot, a version that does not match, edits that overlap, and any create, rename or delete. The app applies the plan, after its own permission checks.

[`applyWorkspaceEdit`](/editor-react/project#workspace-edits) of the editor views goes further: it edits open editors, stages drafts and moves files, but checks no versions.

## Files and URIs

`pathToFileUri(path)` makes a `file:` URI of a POSIX or Windows path, escaping each segment. `fileUriToPath(uri)` goes back, or returns `null` for another scheme. Neither checks that a path is inside the project.

`session.watchedFiles()` returns the file watchers the server registered. `watchesFile(watchers, root, path, type)` says whether a change of a path concerns them, with `type` `1` created, `2` changed or `3` deleted; send those with `session.didChangeWatchedFiles(changes)`. A path in `node_modules`, `vendor` or `.git` only matches a pattern that names that folder. Watching the disk is the app's work. `globMatch(path, pattern)` is the protocol's glob on its own.

For a file that moves, `session.willRenameFiles(files)` asks the server for the edits that come with the move, such as changed imports, and `didRenameFiles(files)` tells it afterwards. Each `RenamedFile` has `oldUri`, `newUri` and whether it is a `directory`. Only the files the server's filters take are sent; `fileOperationFilters(operation)` and `renamesTaken(filters, files)` are that filter. Moving the file is the app's.
