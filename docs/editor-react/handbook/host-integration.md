# Host operations and document ownership

Construct `new ProjectLanguage(service, host?)`. The service is an injected `LanguageService`; `LanguageHost` describes optional application operations. There is no process-backed service factory hidden inside the constructor.

| `LanguageHost` field            | Host responsibility                                                       |
| ------------------------------- | ------------------------------------------------------------------------- |
| `folder`                        | Project path for relative display; default empty string                   |
| `files`                         | Authorized text/draft/save/rename adapter                                 |
| `apple`, `keymap`               | Same platform and resolved table as the editor engine                     |
| `openPlace(place)`              | Open another file/view and route focus; position is zero-based            |
| `pathOfUri(uri)`                | Optional stored/display path mapping; return `null` for unsupported URIs  |
| `serverNames(uri)`              | Optional display names for diagnostics/information                        |
| `notify(notification)`          | Display stable-id success/error messages                                  |
| `suggestNames(request, signal)` | Optional rename suggestions; host selects the provider and privacy policy |

`DiskText` contains `text` and `mtime`. `EditorNotification` has `id`, `kind: 'success' | 'error'`, and `title`. A `RenameSuggestionsRequest` carries URI, language id, original name, context, and uses. No on-device capability is implied by that callback.

## Shared documents

`acquire(uri, languageId, editor)` returns a `LanguageDocumentHandle` with `uri`, `service`, `ready`, and idempotent `release`. The first editor for a URI sends synchronization. Further editors share that document handle; the project does not copy their text into one another. The host must keep duplicate file views on the same draft text.

Changes during opening queue and flush after `openDocument` resolves. Releasing before opening finishes drops pending changes and closes after opening. If the syncing editor closes while another remains, the surviving editor takes ownership and reopens/joins with its own text. After the final release the project closes the service document. Disposing the project stops sync and diagnostics subscriptions and schedules document closure; it does not shut down the service's transport or process.

`ready` exposes opening failure to the caller. Background change/close failures are currently caught by the coordinator; a real service needs independent error/status reporting. Do not rely on the absence of an unhandled rejection as proof that the backend has current text.

`readText` reads an open editor, then the file adapter. `pathOfLocation` uses the host mapper or a file URI path relative to `folder` for display. This display mapping does not authorize that path. `openPlace`, `jumpTo`, `noteCaret`, and `takeCaret` preserve navigation history and a requested destination column while a host opens a new file.

## Workspace edits

`ProjectLanguage.applyWorkspaceEdit` delegates to the exported `applyWorkspaceEdit(edit, host)`. `WorkspaceEditHost` has `editorOf(uri)` and `files: ProjectFiles | null`. `ProjectFiles` must implement all four operations:

| Method             | Result / action                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `read(path)`       | `Promise<DiskText                                                                      \| null>` from a draft or authorized text file |
| `stage(files)`     | Put `StagedFile[]` into unsaved drafts and notify; no disk write                                                                      |
| `save(files)`      | Authorized writes, returning first refusal reason or `null`                                                                           |
| `rename(from, to)` | Authorized file/folder move plus host state/server updates, returning reason or `null`                                                |

A `StagedFile` includes `path`, original `disk`, and resulting `text`. The original disk record lets the host enforce its conflict policy. Do not treat its `mtime` as a package-provided atomic write guarantee.

The adapter plans and validates text ranges before applying anything. Open documents take edits through `editor.applyEdits`; unopened text-only changes become unsaved staged drafts. When the edit includes renames, unopened text edits are saved through the host and rename steps run in order. Open-editor edits remain editor operations, so the host's rename adapter must coordinate those drafts and any required persistence.

Create/delete operations are refused with `Creating and deleting files is not supported yet`. Unsupported URI schemes or unreadable files are refused. Invalid/overlapping text edits are refused before execution. Read-only editor failures and host save/rename failures return `{ applied: false, failureReason }`.

Current limits matter for host policy: this React adapter does not check `TextDocumentEdit.version`, apply change-annotation confirmation, enforce rename options, or roll back already completed steps after a runtime failure. Its preflight range validation is not a cross-file transaction. For version-aware text-only planning, use [`planWorkspaceEdit`](/lsp/handbook/documents-edits#planning-workspace-edits), or reject/revalidate stale plans at the host boundary before executing them.

## An in-memory draft adapter

```ts
import type { ProjectFiles, StagedFile, DiskText } from '@adecore/editor-react';

export function memoryFiles(initial: ReadonlyMap<string, DiskText>) {
    const disk = new Map(initial);
    const drafts = new Map<string, StagedFile>();
    const files: ProjectFiles = {
        async read(path) {
            const draft = drafts.get(path);
            return draft === undefined ? (disk.get(path) ?? null) : { ...draft.disk, text: draft.text };
        },
        stage(changes) {
            for (const change of changes) {
                drafts.set(change.path, change);
            }
        },
        async save() {
            return 'This example only stages drafts';
        },
        async rename() {
            return 'This example does not move files';
        }
    };
    return { files, drafts };
}
```

This is a working adapter with explicit refusal behavior, not a filesystem implementation. A production adapter must add containment checks, authorization, concurrency/conflict checks, persistence, and rename notifications before returning success.
