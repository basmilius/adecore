# Projects and documents

`new ProjectLanguage(service, host?)` holds the language service of one project and everything its editors share: the open documents, the [navigation history](/editor-react/navigation#history) and the problems. Create one per project and dispose it after its editors.

## LanguageHost

The `host` is what the app allows the features to do. Every field is optional.

| Field                                   | What the app does                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folder`                                | The project's folder, so paths show relative to it                                                                                                                                |
| `files`                                 | Reads, drafts, saves and renames files; see [workspace edits](#workspace-edits)                                                                                                   |
| `keymap`, `apple`                       | The same resolved [key table](/editor/options#keymaps) and platform as the engine                                                                                                 |
| `i18n`                                  | The i18next instance the features read their words from; the default instance without one                                                                                         |
| `panelBodyHeight`, `onPanelResize(height)` | The body height in pixels of the peek and call hierarchy panels (180), and the call that reports a person's resize so the app can keep it |
| `openPlace(place)`                      | Opens another file at a zero-based position; the features call it to go to a definition elsewhere                                                                                 |
| `openExternal(url)`                     | Opens a web address outside the editor, from a [document link](/editor-react/language-features#document-links) or a server's `window/showDocument`; a new browser window without it |
| `onServerMessage(message)`              | A `ServerMessage` to show a person (`kind: 'show'`) or log (`'log'`); dropped without it                                                                                         |
| `pathOfUri(uri)`                        | The path to show for a URI, or `null`; without it, `file:` URIs under `folder` are made relative                                                                                  |
| `serverNames(uri)`                      | The names of the servers of a document, for the cards                                                                                                                             |
| `problemSource`                         | Where [`project.problems`](#problems) reads its reports; the service's diagnostics without one |
| `notify(notification)`                  | Shows a short `success` or `error` message with an `id` and a `title`, such as a toast                                                                                            |
| `clipboard` | The [`ClipboardHistory`](#clipboard-history) that Paste from History lists; a new one per project without it |
| `templates`, `saveAsLiveTemplate(draft)`, `openTemplateSettings()` | The [`TemplateRegistry`](/editor-react/templates#the-registry) (built-in templates only without it), the call Save as Live Template makes with a `LiveTemplateDraft`, and the call that opens the host's template settings |
| `editHistoryLimit` | How many places [Last Edit Location](/editor-react/navigation#edit-locations) remembers; 150 |
| `resolveSnippetVariable(name, context)`, `snippetTransformWorker` | [Snippet variables](/editor-react/completion#variables-and-indentation) and the [transform worker](/editor-react/completion#isolated-snippet-transforms) |
| `suggestNames(request, signal)`         | Suggests new names during a rename, from any source the app picks                                                                                                                 |

`openPlace` only asks. The app opens the file; when that editor puts its caret on the line, the feature moves it to the column (`takeCaret`). `jumpTo(place)` does the same from outside an editor, such as a problems panel, and records the last caret in the history.

## Documents

`EditorLanguage` acquires the document of its URI from the project. The first editor of a URI opens it on the service and sends its changes. Later editors of the same URI join it and send nothing. When the sending editor closes, the next one takes over. After the last one, the project closes the document.

`acquire(uri, languageId, editor, { serve: false })` registers an editor no server serves, such as plain text. It counts as open (`openEditors()` lists one editor per URI, in opening order), but its handle's `service` is `unservedLanguageService()`, so its features stay inert. A later served acquire opens the document on the service. `EditorLanguage` takes the same `serve` in its `EditorLanguageOptions`; `served` says what it chose, and `language.service` is the service for this document.

Two editors of one file share a document, not a text. The app keeps their texts equal, for example with [`setText`](/editor/editing#replacing-the-text).

`document.ready` rejects when opening failed. Later failures of a change or close are swallowed; the service reports its own errors.

The features ask for symbols, folds, inlay hints, semantic colors, code actions and code vision when the document opens, after an edit, and when the service fires `onProvidersChanged`. `language.onProvidersChanged(listener)` is that signal for one editor.

## Clipboard history

Every copy and cut in the project's editors goes into `project.clipboard`, a `ClipboardHistory`, newest first. `new ClipboardHistory(options)` takes a `limit` (100 entries), a `maxLength` in UTF-16 units, the `entries` a host kept, `onChange(entries)` to keep them again, and a `clock`. `add(text, { wholeLines })` puts a text on top, moving a repeat up. `remove(entry)`, `promote(entry)` and `clear()` change it, and `subscribe(listener)` hears every change. An entry has its `text`, `wholeLines` (copied from bare carets) and the time `at`.

`language.pasteHistory.open()` lists the entries in a pick list, as `pasteFromHistory` (`Mod+Shift+V`) does. Typing narrows the list, Shift with the arrows picks several, and Delete forgets them. Enter pastes the chosen entries, joined by line breaks, at every caret, as a normal paste does. The text also goes to the system clipboard.

`pasteAsPlainText` (`Mod+Alt+Shift+V`) pastes the system clipboard without reindenting it. It does nothing where the clipboard cannot be read.

## Workspace edits

`project.applyWorkspaceEdit(edit)` applies a language server's edit, such as a rename across files. `applyWorkspaceEdit(edit, host)` does the same without a project; its `WorkspaceEditHost` has `editorOf(uri)` and `files`.

It plans the edit first with [`planWorkspaceOperations`](/lsp/documents#resource-operations), so an edit that does not fit changes nothing. Before each step it checks that open editors still hold the planned text and version, and that a delete or overwrite loses no unsaved work. A step that no longer fits stops the edit there. Steps that already ran stay applied; nothing rolls back.

- A file open in an editor takes its edits as one undo step.
- Any other file becomes an unsaved draft through `files.stage`. Nothing is written on a server's word alone.
- With moves in the edit, the drafts are saved through `files.save` and the moves go through `files.rename`.
- A created file goes through `files.create`, with all the text the edit writes into it. An existing target is refused unless the edit says `ignoreIfExists`. `overwrite` needs `files.supportsOverwrite`. Closing or reloading an editor on a replaced target is up to the host.
- A deleted file or folder goes through `files.delete`.
- A version in the edit must match the editor's. The host gives `versionOf(uri)` (`project.applyWorkspaceEdit` uses `service.versionOf`); without it, the text check stands in. A version for a file no editor holds is refused.

`ProjectFiles` is the app's side:

| Method                         | What it does                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `read(path)`                   | The `DiskText` (`text`, `mtime`) of a file, from its draft or the disk; or `null`                                    |
| `stage(files)`                 | Puts `StagedFile`s (`path`, `disk`, `text`) in drafts and tells the person                                           |
| `save(files)`                  | Writes the files; returns the reason the first one failed, or `null`                                                 |
| `rename(from, to, options?)`   | Moves a file or folder; `options.overwrite` replaces a target that is there. Returns the reason it failed, or `null` |
| `create(path, text, options?)` | Optional. Makes a file; `options.overwrite` empties one that is there. Returns the reason it failed, or `null`       |
| `delete(path, { recursive })`  | Optional. Deletes a file, or a folder with what is in it; returns the reason it failed, or `null`                    |
| `isUnsaved(path)`              | Optional. Whether a draft or an open editor at the path, or under it for a folder, holds unsaved text                |
| `exists(path)`                 | Optional. Whether anything is at the path, folders and files that are not text included; see below                   |
| `isFolder(path)`               | Optional. Whether the path is a folder                                                                               |
| `supportsOverwrite`            | Optional flag. Whether `create` and `rename` take `overwrite`; without it an overwrite is refused                    |

The permission checks belong in these methods. An edit that needs a method `ProjectFiles` lacks is refused. Pass `supportedResourceOperations(files)` as the session's `resourceOperations`, so servers only ask for what can be done. Without `isUnsaved`, deleting a file an editor holds is refused, and a recursive delete needs `openUris()` on the host. Without `isFolder`, deleting anything but a text file needs `recursive`. Without `exists`, `ignoreIfNotExists` cannot be honored, so `create` and `rename` must refuse an existing target themselves.

The host tells the servers, inside these methods. After `rename`, `create` or `delete` succeeds, call `project.didCreateFiles` or `project.didDeleteFiles` (or the session's `didRenameFiles`). For a file the person creates or deletes outside a server's edit:

- `project.willCreateFiles(targets)` and `project.willDeleteFiles(targets)` return the `WorkspaceEdit` the servers want first, or `null`. Apply it with `project.applyWorkspaceEdit`.
- `project.didCreateFiles(targets)` and `project.didDeleteFiles(targets)` tell the servers afterwards.

A target is an absolute path, or `{ path, directory: true }` for a folder. Only files the servers' filters take are sent. A service without the matching optional `willCreateFiles`, `didCreateFiles`, `willDeleteFiles` and `didDeleteFiles` makes these no-ops.

`WorkspaceEditHost` also takes `versionOf(uri)`, `isReadOnly(uri)` and `openUris()`. A read only editor, from `isReadOnly(uri)` or the editor's own `isReadOnly()`, refuses the edit before any step runs.

## Problems

`project.problems` is a `ProjectProblems` store of every file's problems, for a problems panel. `subscribe` and `getSnapshot` fit `useSyncExternalStore`. A `ProblemFile` has a `path` and its `rows`; a `ProblemRow` has the `diagnostic` and the `server` that reported it. Rows go worst first, then in file order, and files by path. Hints are left out.

```tsx
const files = useSyncExternalStore(project.problems.subscribe, project.problems.getSnapshot);
const counts = countsOf(files); // { error, warning, info }
```

Without a `problemSource`, the reports come from the service's diagnostics. A `problemSource` passes every `ProblemReport` (`path`, `server`, `diagnostics`) to its listener and returns its stop function; use it to report files no editor holds. A report replaces the earlier one of that server for that file. `serviceProblems(service, pathOf)` is the default source, and `new ProjectProblems(source)` builds a store outside a project.

```ts
const project = new ProjectLanguage(service, {
    folder,
    problemSource: (listener) => machine.onDiagnostics((event) => listener({ path: event.path, server: event.server, diagnostics: event.diagnostics }))
});
```

For the counts of one file, see [`useProblemCounts`](/editor-react/hover#problems).
