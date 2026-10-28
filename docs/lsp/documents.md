# Documents and edits

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

## Edit helpers

The protocol has two shapes of edit, and mixing them up gives wrong text:

| Shape                                  | Ranges are in                        | Helper                               |
| -------------------------------------- | ------------------------------------ | ------------------------------------ |
| `ContentChange`, as in `didChange`     | The text the change before it left   | `applyContentChanges(text, changes)` |
| `TextEdit`, as in formatting or rename | The text before all of them, at once | `applyTextEdits(text, edits)`        |

```ts
import { applyContentChanges, applyTextEdits, minimalChange } from '@adecore/lsp';

const after = applyTextEdits('red blue red', [
    { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: 'green' },
    { range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }, newText: 'green' }
]);
// 'green blue green'

applyContentChanges('red blue red', [minimalChange('red blue red', after)]) === after; // true
```

`applyTextEdits` rejects overlapping edits. Insertions at one position keep their order. `minimalChange(before, after)` returns the single `ContentChange` between two texts, never splitting a surrogate pair or a `\r\n`.

A host that keeps its own copy of a document can hold it in a `TextMirror`. `new TextMirror(text)` stores lines, so `applyChanges(changes)` costs only the touched lines. `text` joins them and `lineCount` counts them. A change that does not fit throws and leaves the text unchanged, including earlier entries of the same call.

## Workspace edits

`planWorkspaceEdit(edit, snapshots)` works out a `WorkspaceEdit` in memory. `snapshots` maps each URI to a `DocumentSnapshot` (`text`, `version` or `null`). It returns a `PlannedDocumentEdit` per document: `uri`, `version`, `before` and the planned `text`. A created file has no snapshot and is planned from empty text with `created: true`. Create it exclusively so a file that appeared meanwhile is not overwritten.

It throws an `LspError` for a missing snapshot, a version mismatch, overlapping edits, a create over an existing snapshot (unless `overwrite` or `ignoreIfExists`), and any rename or delete. The app applies the plan after its own permission checks. For renames and deletes, use [resource operations](#resource-operations).

### Resource operations

`planWorkspaceOperations(edit, source)` plans for a host that also creates, moves and deletes files. It is async, changes nothing and returns a `WorkspaceEditPlan` whose `steps` follow the edit's order. It rejects with an `LspError` on the first change that does not fit. A version mismatch has the code `ContentModified`.

The `WorkspaceEditSource` is the host's side:

| Member          | What it gives                                                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read(uri)`     | A `WorkspaceEditText` (`text`, `version`, `open`), or `null` when there is no such text file                                                                                                                                                                                                        |
| `exists(uri)`   | Optional. Whether anything is there, asked after `read` returned `null`. Without it, such a URI counts as unknown: moves and deletes of it are left to the host, and creates onto it plan no overwrite |
| `isFolder(uri)` | Optional. Whether the URI is a folder                                                                                                                                                                                                                                                               |
| `operations`    | The `ResourceOperationKind`s (`create`, `rename`, `delete`) the host carries out                                                                                                                                                                                                                    |

A step is a `PlannedTextStep` (`uri`, `readUri`, `edits`, `before`, `after`, `version`, `open`), a `PlannedCreateStep` (`uri`, `text`, `overwrite`), a `PlannedRenameStep` (`oldUri`, `newUri`, `overwrite`) or a `PlannedDeleteStep` (`uri`, `recursive`). The rules:

- A text edit's version must equal the source's `version`. A version on a file that is not `open` is refused. Legacy `changes` and files the plan creates are not checked.
- An operation outside `operations` is refused.
- A create or rename onto an existing target is refused unless it says `overwrite` or `ignoreIfExists` (`overwrite` wins). A rename of something missing is always refused.
- A delete of something missing is refused unless it says `ignoreIfNotExists`.
- Deleting a folder needs `recursive`. Without `isFolder`, so does deleting anything that exists and is not a text file.
- Edits to a URI after it was deleted or moved away are refused. Edits to a moved file are read from its old place (`readUri`). Edits to a created file become its `text`.
- Overlapping edits are refused. Folders match by URI prefix as spelled, so spell the URIs of one edit the same way.

Running the plan is up to the host and is not atomic. The session announces `failureHandling: 'abort'`: a failing step leaves earlier steps done, with no rollback. [`applyWorkspaceEdit`](/editor-react/project#workspace-edits) is a host built on this planner. Pass `resourceOperations` to the [session](/lsp/sessions) so servers send only what the host supports.

## Files and URIs

`pathToFileUri(path)` makes a `file:` URI of a POSIX or Windows path, escaping each segment. `fileUriToPath(uri)` goes back, or returns `null` for another scheme. Neither checks that a path is inside the project.

`session.watchedFiles()` returns the watchers the server registered. `watchesFile(watchers, root, path, type)` says whether a change concerns them, with `type` `1` created, `2` changed or `3` deleted. Send matches with `session.didChangeWatchedFiles(changes)`. A path in `node_modules`, `vendor` or `.git` only matches a pattern that names that folder. Watching the disk is the app's job.

For file operations the session has a `will` and a `did` method each: `willRenameFiles`/`didRenameFiles` take `RenamedFile` entries (`oldUri`, `newUri`, `directory`), `willCreateFiles`/`didCreateFiles` take `CreatedFile` and `willDeleteFiles`/`didDeleteFiles` take `DeletedFile` (`uri`, `directory`). A `will` method returns the server's `WorkspaceEdit`, such as changed imports, or `null`. Apply it as any other [workspace edit](/editor-react/project#workspace-edits) before the files change, then call the `did` method. A server asked before a delete expects the files to still exist. Only files the server's filters accept are sent. `fileOperationFilters(operation)` builds that filter. Moving, creating and deleting the files is the app's job.
