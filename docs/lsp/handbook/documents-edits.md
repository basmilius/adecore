# Documents, versions, and edits

`session.openDocument(item)` returns `LspDocument` and takes a URI that is not already open in that session. `item` has `uri`, `languageId`, `text`, and optional `version` (default 1). Versions must be nonnegative safe integers. Await `document.ready` before assuming the opening notification reached the transport.

The URI remains occupied until `close()` finishes, so a reopen cannot overtake a queued close. `getDocument(uri)` returns the held instance. `LspDocument` owns that session's text/version; a higher-level `LanguageService` adapter owns sharing across editor clients or servers.

## Synchronization

`updateText(text)` computes a minimal range change, doing nothing when text is unchanged. `applyChanges(changes)` applies sequential `ContentChange` values and increments the version once per successful call, even when their final text is unchanged. Full-sync servers receive the final full text; incremental-sync servers receive the ordered changes. A server that did not negotiate changes is refused with method-not-found.

Opening, changes, requests, save, and close are ordered through the document's synchronization queue. A change cancels its outstanding feature requests. Results that arrive after a version change or close reject as stale. `save()` sends `didSave` only if the server requested it, including text when requested. It does not write a file; call it after the host saves successfully.

`close()` is idempotent, cancels requests, waits for queued sync, sends `didClose` when negotiated, and clears diagnostics. A connection failure calls `disconnect` on its documents and does not try to send to a dead transport.

## Edit shapes are not interchangeable

| Shape / helper                                    | Rule                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ContentChange`, `applyContentChanges`            | Sequential ranges against the result of the previous entry; no range means replace all |
| LSP `TextEdit`, `applyTextEdits`                  | Simultaneous ranges in original text, replacement field `newText`                      |
| Editor `EditorContentChange`, `editor.applyEdits` | Simultaneous command batch, replacement field `text`                                   |
| Editor `onTextChange.changes`                     | Sequential notification entries                                                        |
| Core `TextEdit`                                   | Simultaneous UTF-16 offsets `from`/`to`                                                |

LSP `Position.character` is UTF-16. `offsetAt` and `positionAt` validate integers and bounds instead of clamping. These helpers recognize LF, CRLF, and lone CR; the editor core indexes lines by LF. Normalize lone-CR text before sharing it with the core or explicitly reconcile that difference.

`applyTextEdits` rejects reversed/overlapping ranges. Multiple insertions at one position keep input order, unlike the core model which refuses distinct same-offset insertions. Combine those insertions before applying them to a core/editor command batch.

```ts
import { applyContentChanges, applyTextEdits, minimalChange } from '@adecore/lsp';

const before = 'red blue red';
const after = applyTextEdits(before, [
    { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: 'green' },
    { range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }, newText: 'green' }
]);
console.assert(after === 'green blue green');
console.assert(applyContentChanges(before, [minimalChange(before, after)]) === after);
```

`minimalChange` preserves shared text around one changed stretch and avoids boundaries inside surrogate pairs or CRLF. `endPosition` returns the final protocol position.

## Planning workspace edits

`planWorkspaceEdit(edit, snapshots)` computes `PlannedDocumentEdit[]` in memory. Each `DocumentSnapshot` has `text` and `version: number | null`. The planner validates a supplied version, combines repeated changes for a URI in order, and returns original `before` plus planned `text`. It performs no write or editor mutation. Missing snapshots, mismatched versions, overlapping edits, and all create/rename/delete operations throw `LspError`.

The React [`applyWorkspaceEdit`](/editor-react/handbook/host-integration#workspace-edits) adapter adds open-editor edits, draft staging, and host renames. It has different version and rollback limits; choose the correct layer deliberately.

`pathToFileUri` escapes path segments and handles POSIX/Windows drive paths. `fileUriToPath` returns `null` for other schemes or malformed URLs. These are coordinate helpers, not canonical-path or workspace-containment checks. Validate paths and permissions in the host.
