# Projects and documents

The first argument may also be a `LanguageServiceFactory`, a function that gets the project and returns the service. It runs once in the constructor. A service that needs the text of the editor that holds a document, or a way to apply the edit a server asks for, takes them from `project.openTextOf(uri)` and `project.applyWorkspaceEdit(edit)` instead of tracking editors itself. `project.onDispose(callback)` runs a callback when the project is disposed.

`new ProjectLanguage(service, host?)` holds the language service of one project and everything its editors share: the open documents, the [navigation history](/editor-react/navigation#history), the [problems](/editor-react/problems#in-the-project) and the clipboard history. Create one per project and dispose it after its editors.

```ts
const project = new ProjectLanguage(service, {
    folder: '/shop',
    keymap,
    apple,
    files,
    openPlace: (place) => openTab(place.uri, place.position),
    notify: (notification) => toast(notification.kind, notification.title)
});

// When the project closes, after its editors:
project.dispose();
```

## LanguageHost

The `host` is what the app allows the features to do. Every field is optional. `LanguageHost` is the parts below put together, each declared beside the feature that reads it: `NavigationHost`, `PanelsHost`, `ProblemsHost`, `TemplatesHost`, `ClipboardHost`, `SnippetsHost`, `MessagesHost` and `RenameHost`. An app that implements one concern can type its part alone.

| Field                                                              | What the app does                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folder`                                                           | The project's folder, so paths show relative to it                                                                                                                                                                        |
| `files`                                                            | Reads, drafts, saves and renames files; see [workspace edits](/editor-react/workspace-edits#the-files)                                                                                                                    |
| `keymap`, `apple`                                                  | The same resolved [key table](/editor/options#keymaps) and platform as the engine                                                                                                                                         |
| `i18n`                                                             | The i18next instance the features read their words from; the default instance without one                                                                                                                                 |
| `panelBodyHeight`, `onPanelResize(height)`                         | The body height in pixels of the peek and call hierarchy panels (180), and the call that reports a person's resize so the app can keep it                                                                                 |
| `openPlace(place)`                                                 | Opens another file at a zero-based position; the features call it to go to a definition elsewhere                                                                                                                         |
| `openExternal(url)`                                                | Opens a web address outside the editor, from a [document link](/editor-react/language-features#document-links) or a server's `window/showDocument`; a new browser window without it                                       |
| `onServerMessage(message)`                                         | A `ServerMessage` to show a person (`kind: 'show'`) or log (`'log'`); dropped without it                                                                                                                                  |
| `pathOfUri(uri)`                                                   | The path to show for a URI, or `null`; without it, `file:` URIs under `folder` are made relative                                                                                                                          |
| `serverNames(uri)`                                                 | The names of the servers of a document, for the cards                                                                                                                                                                     |
| `problemSource`, `pullWorkspaceProblems(uri, options)` | Where [`project.problems`](/editor-react/problems#in-the-project) reads its reports (the service's diagnostics without one), and how a check of the whole project is asked (the service's workspace diagnostics without it) |
| `notify(notification)`                                             | Shows a short message, an `EditorNotification` with an `id`, a `kind` of `success` or `error` and a `title`, such as a toast                                                                                              |
| `clipboard`                                                        | The [`ClipboardHistory`](#clipboard-history) that Paste from History lists; a new one per project without it                                                                                                              |
| `templates`, `saveAsLiveTemplate(draft)`, `openTemplateSettings()` | The [`TemplateRegistry`](/editor-react/templates#the-registry) (built-in templates only without it), the call Save as Live Template makes with a `LiveTemplateDraft`, and the call that opens the host's template settings |
| `editHistoryLimit`                                                 | How many places [Last Edit Location](/editor-react/navigation#edit-locations) remembers; 150                                                                                                                              |
| `resolveSnippetVariable(name, context)`, `snippetTransformWorker`  | [Snippet variables](/editor-react/snippets#variables-and-indentation) and the [transform worker](/editor-react/snippets#isolated-transforms)                                                                              |
| `suggestNames(request, signal)`                                    | Suggests new names during a rename, from any source the app picks; the `RenameSuggestionsRequest` holds the name, its kind, the code around it and a few uses                                                             |

`openPlace` only asks. The app opens the file; when that editor puts its caret on the line, the feature moves it to the column (`takeCaret`). `jumpTo(place)` does the same from outside an editor, such as a problems panel, and records the last caret in the history.

## Documents

`EditorLanguage` acquires the document of its URI from the project. The first editor of a URI opens it on the service and sends its changes. Later editors of the same URI join it and send nothing. When the sending editor closes, the next one takes over. After the last one, the project closes the document. `acquire` returns a `LanguageDocumentHandle`: the `uri`, the `service` the document's features ask, a `ready` promise and `release()`.

`acquire(uri, languageId, editor, { serve: false })` registers an editor no server serves, such as plain text. Its fourth argument is an `AcquireOptions`. It counts as open (`openEditors()` lists one editor per URI, in opening order), but its handle's `service` is `unservedLanguageService()`, so its features stay inert. A later served acquire opens the document on the service. `EditorLanguage` takes the same `serve` in its `EditorLanguageOptions`; `served` says what it chose, and `language.service` is the service for this document.

Two editors of one file share a document, not a text. The app keeps their texts equal, for example with [`setText`](/editor/editing#replacing-the-text).

`document.ready` rejects when opening failed. The project swallows later failures of a change or close; the service reports its own errors.

The features ask for symbols, folds, inlay hints, semantic colors, code actions and code vision when the document opens, after an edit, and when the service fires `onProvidersChanged`. `language.onProvidersChanged(listener)` is that signal for one editor.

## Language ids

The editor names a language by its highlighter id, a server by its LSP id. `lspLanguageIdOf(language)` gives the LSP id of a highlighter id, such as `typescriptreact` for `tsx`, or `null` when no server here knows it. `shikiLanguageOf(lspLanguageId)` goes the other way, for code a server sends back to be drawn. `shikiLanguageOfPath(path)` picks a highlighter id by file extension, for a file known only by its path, and falls back to `text`.

```ts
const languageId = lspLanguageIdOf('tsx'); // 'typescriptreact'
```

## Clipboard history

Every copy and cut in the project's editors goes into `project.clipboard`, a `ClipboardHistory`, newest first. `new ClipboardHistory(options)` takes `ClipboardHistoryOptions`: a `limit` (100 entries), a `maxLength` in UTF-16 units, the `entries` a host kept, `onChange(entries)` to keep them again, and a `clock`. `add(text, { wholeLines })` puts a text on top, moving a repeat up. `remove(entry)`, `promote(entry)` and `clear()` change it, and `subscribe(listener)` hears every change. A `ClipboardEntry` has its `text`, `wholeLines` (copied from bare carets) and the time `at`.

```ts
const clipboard = new ClipboardHistory({ entries: stored.load(), onChange: (entries) => stored.save(entries) });
const project = new ProjectLanguage(service, { folder, clipboard });
```

`language.pasteHistory`, a `PasteHistoryFeature`, opens the entries in a pick list with `open()`, as `pasteFromHistory` (`Mod+Shift+V`) does. Typing narrows the list, Shift with the arrows picks several, and Delete forgets them. Enter pastes the chosen entries, joined by line breaks, at every caret, as a normal paste does. The text also goes to the system clipboard.

`pasteAsPlainText` (`Mod+Alt+Shift+V`) pastes the system clipboard without reindenting it. It does nothing where the clipboard cannot be read.
