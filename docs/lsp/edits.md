# Edits

The protocol has two shapes of text edit and one edit across files. The helpers apply them to strings and plan the cross-file edit in memory. None of them reads or writes a file.

## Edit helpers

Mixing up the two shapes gives wrong text:

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

## A mirror of a document

A host that keeps its own copy of a document, such as a backend that relays changes to several servers, can hold it in a `TextMirror`. Start one with `new TextMirror(text)`. `applyChanges(changes)` costs only the touched lines. `text` joins them and `lineCount` counts them. A change that does not fit throws and leaves the text unchanged, including earlier entries of the same call.

```ts
import { TextMirror } from '@adecore/lsp';

const mirror = new TextMirror('const a = 1;\n');

mirror.applyChanges([{ range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } }, text: 'total' }]);
mirror.text; // 'const total = 1;\n'
```

## Workspace edits

A rename or a code action answers with a `WorkspaceEdit` that can touch many files. `planWorkspaceEdit(edit, snapshots)` works out the new text of each file in memory. `snapshots` maps each URI to a `DocumentSnapshot` (`text`, `version` or `null`). It returns a `PlannedDocumentEdit` per document: `uri`, `version`, `before` and the planned `text`. A created file has no snapshot, so the plan starts it from empty text and sets `created: true`. Create it exclusively, so the app does not overwrite a file that appeared meanwhile.

```ts
import { planWorkspaceEdit } from '@adecore/lsp';

const edit = await document.rename({ line: 0, character: 6 }, 'total');

if (edit !== null) {
    const plan = planWorkspaceEdit(edit, new Map([[document.uri, { text: currentText, version: document.version }]]));
    // Check permissions, then write each planned text.
}
```

It throws an `LspError` for a missing snapshot, a version mismatch, overlapping edits, a create over an existing snapshot (unless `overwrite` or `ignoreIfExists`), and any rename or delete. For renames and deletes, use resource operations.

## Resource operations

`planWorkspaceOperations(edit, source)` plans for a host that also creates, moves and deletes files. It is async, changes nothing and returns a `WorkspaceEditPlan` whose `steps` follow the edit's order. It rejects with an `LspError` on the first change that does not fit. A version mismatch has the code `ContentModified`.

The `WorkspaceEditSource` is the host's side:

| Member          | What it gives                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read(uri)`     | A `WorkspaceEditText` (`text`, `version`, `open`), or `null` when there is no such text file                                                                                                            |
| `exists(uri)`   | Optional. Whether anything is there, asked after `read` returned `null`. Without it, such a URI counts as unknown: moves and deletes of it are left to the host, and creates onto it plan no overwrite |
| `isFolder(uri)` | Optional. Whether the URI is a folder                                                                                                                                                                   |
| `operations`    | The `ResourceOperationKind`s (`create`, `rename`, `delete`) the host carries out                                                                                                                        |

Each step is a `WorkspaceEditStep`, one of four:

- A `PlannedTextStep` (`uri`, `readUri`, `edits`, `before`, `after`, `version`, `open`).
- A `PlannedCreateStep` (`uri`, `text`, `overwrite`).
- A `PlannedRenameStep` (`oldUri`, `newUri`, `overwrite`).
- A `PlannedDeleteStep` (`uri`, `recursive`).

The planner follows these rules:

- A text edit's version must equal the source's `version`. The planner refuses a version on a file that is not `open`, and does not check legacy `changes` or files the plan creates.
- It refuses an operation outside `operations`.
- It refuses a create or rename onto an existing target unless the operation says `overwrite` or `ignoreIfExists` (`overwrite` wins). It always refuses a rename of something missing.
- It refuses a delete of something missing unless the operation says `ignoreIfNotExists`.
- Deleting a folder needs `recursive`. Without `isFolder`, so does deleting anything that exists and is not a text file.
- It refuses edits to a URI after the plan deleted or moved it away. It reads edits to a moved file from the old place (`readUri`). Edits to a created file become its `text`.
- It refuses overlapping edits. Folders match by URI prefix as spelled, so spell the URIs of one edit the same way.

The host runs the plan, and the run is not atomic. The session announces `failureHandling: 'abort'`, so a failing step leaves earlier steps done, with no rollback. [`applyWorkspaceEdit`](/editor-react/workspace-edits) is a host built on this planner. Pass `resourceOperations` to the [session](/lsp/sessions#options) so servers send only what the host supports.
