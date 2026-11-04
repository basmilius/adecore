# Reference

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release. `@adecore/editor/editor.css` holds the styles; see [Getting started](/editor/getting-started#styles).

## `@adecore/editor`

The engine, the `Editor` contract and its types, the Shiki adapters and the helpers it re-exports from `@adecore/editor-core`.

<ExportTable entry="@adecore/editor" />

## `@adecore/editor/keymap`

The key table and the functions that resolve, print and parse chords. See [keymaps](/editor/options#keymaps).

<ExportTable entry="@adecore/editor/keymap" />

## `@adecore/editor/shiki`

The Shiki adapters and the steps behind them, for a code viewer that colors the same way. See [Theme and syntax](/editor/theme#shiki).

<ExportTable entry="@adecore/editor/shiki" />

## `@adecore/editor/shiki-worker`

Syntax tokens for a diff, served from a worker. See [diff syntax in a worker](/editor/theme#diff-syntax-in-a-worker).

<ExportTable entry="@adecore/editor/shiki-worker" />

## `@adecore/editor/search-worker`

Regular expression search off the page. See [the search worker](/editor/find#search-worker).

<ExportTable entry="@adecore/editor/search-worker" />

## `@adecore/editor/worker-client`

The request lifecycle the search client is built on. See [a worker client of your own](/editor/find#a-worker-client-of-your-own).

<ExportTable entry="@adecore/editor/worker-client" />

## `@adecore/editor/fake`

An `Editor` without a DOM, for tests of host code. See [Testing](/editor/testing#a-fake-editor).

<ExportTable entry="@adecore/editor/fake" />

## `@adecore/editor/testing`

The real editor on a LinkeDOM page. See [Testing](/editor/testing#a-real-editor-on-a-linkedom-page).

<ExportTable entry="@adecore/editor/testing" />

## Compatibility

An `Editor` implemented outside this package needs `setInputPopup`, `announce`, `setLineLabels` and `setMessages`. Many newer methods are optional, so a host wrapping an older editor checks for them first: `isReadOnly`, `getBaseLineHeight`, `setTodoWords`, `setFontSize`, `getFontSize`, `onFontSizeChange`, `cleanUpWhitespace`, `markSaved`, `setDeclarations`, `onNavigate`, `hasFocus`, `setWordSources`, the [clipboard](/editor/editing#clipboard) members `onCopy` and `paste`, and the [lexical queries](/editor/editing#questions-about-the-code). `EditorMessages` gained `fold` and `unfold`; the `messages` option takes a `Partial<EditorMessages>`.

Newer `KEYMAP` commands are `OptionalKeymapId`s, so a full `Keymap` written before them stays valid and `chordOf` reads the built-in chord. Their defaults:

| Command                                                                                                                                                                                                                 | macOS                                                 | Other                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `moveStatementUp`, `moveStatementDown`                                                                                                                                                                                  | `Mod+Shift+ArrowUp`, `ArrowDown`                      | the same                              |
| `completeCurrentStatement`                                                                                                                                                                                              | `Mod+Shift+Enter`                                     | the same                              |
| `hippieCompletion`, `hippieBackwardCompletion`                                                                                                                                                                          | `Alt+/`, `Alt+Shift+/`                                | the same                              |
| `methodUp`, `methodDown`                                                                                                                                                                                                | `Ctrl+Shift+ArrowUp`, `ArrowDown`                     | `Alt+ArrowUp`, `ArrowDown`            |
| `codeBlockStart`, `codeBlockEnd`                                                                                                                                                                                        | `Mod+Alt+[`, `Mod+Alt+]`                              | `Ctrl+[`, `Ctrl+]`                    |
| `codeBlockStartWithSelection`, `codeBlockEndWithSelection`                                                                                                                                                              | `Mod+Alt+Shift+[`, `Mod+Alt+Shift+]`                  | `Ctrl+Shift+[`, `Ctrl+Shift+]`        |
| `nextChange`, `previousChange`                                                                                                                                                                                          | `Ctrl+Alt+Shift+ArrowDown`, `ArrowUp`                 | the same                              |
| `lastEditLocation`, run by the language side of `@adecore/editor-react`                                                                                                                                                 | `Mod+Shift+Backspace`                                 | the same                              |
| `pasteFromHistory`, run by the language side                                                                                                                                                                            | `Mod+Shift+V`                                         | the same                              |
| `pasteAsPlainText`, an `EditorViewCommand` for `runCommand`                                                                                                                                                             | `Mod+Alt+Shift+V`                                     | the same                              |
| `typeHierarchy`                                                                                                                                                                                                         | `Ctrl+H`                                              | the same                              |
| `toggleRenderedDocs`                                                                                                                                                                                                    | `Ctrl+Alt+Q`                                          | the same                              |
| `insertLiveTemplate`, `surroundWith`, `surroundWithLiveTemplate`, `unwrap`                                                                                                                                              | `Mod+J`, `Mod+Alt+T`, `Mod+Alt+J`, `Mod+Shift+Delete` | the same                              |
| `nextEditLocation`, `wrapWithAbbreviation`, `saveAsLiveTemplate`, `increaseFontSize`, `decreaseFontSize`, `resetFontSize`, `sortLines`, `reverseLines`, `uniqueLines`, `convertIndentsToSpaces`, `convertIndentsToTabs` | none                                                  | none                                  |

Two defaults changed:

- On macOS `selectTextStart` and `selectTextEnd` lost `Meta+Shift+ArrowUp` and `ArrowDown` to `moveStatementUp` and `moveStatementDown`. `Mod+Shift+Home` and `Mod+Shift+End` still select to the text edges. To keep the old chords, pass `resolveKeymap({ selectTextStart: { mac: 'Meta+Shift+ArrowUp' }, selectTextEnd: { mac: 'Meta+Shift+ArrowDown' }, moveStatementUp: { mac: null }, moveStatementDown: { mac: null } })`.
- Off macOS `shrinkSelection` is `Ctrl+Shift+W`, since `Alt+ArrowUp` and `Alt+ArrowDown` are Method Up and Down. To keep the old chord, pass `resolveKeymap({ shrinkSelection: { other: 'Alt+ArrowDown' } })` and move `methodDown` and `methodUp`.

`ProjectLanguage.acquire` takes a fourth parameter, `AcquireOptions` (`{ serve?: boolean }`, default `true`), which a wrapping service must forward to `super.acquire`. `EditorLanguageOptions` gained `serve`, and `EditorLanguage` gained `served` and `service`. Features ask `language.service`, so a document acquired with `serve: false` never reaches the project's service. An `EditorLanguage` can exist for a plain-text file, so read `language.served` to know whether a server handles it. `ProjectLanguage.openEditors()` lists the editors that hold a document.

Other additions on the language side: `LanguageHost` gained `editHistoryLimit` and `clipboard`, `ProjectLanguage` gained `edits` (an `EditLocations`) and `clipboard`, `HistoryFeature` gained `lastEdit` and `nextEdit`, and `EditorLanguage` gained `pasteHistory`. `PickView` gained `query` and `chosen`, so a host building one by hand adds them. `PickSpec` gained `filter`, `multiple`, `acceptMany` and `remove`, `PickRow` gained `search` and `PickPreview` gained `kind`.

### Breaking: Wrap with Abbreviation has no default chord

`wrapWithAbbreviation` lost `Mod+Alt+J` to `surroundWithLiveTemplate`, as in IntelliJ, where Emmet is a row of that list. The command still works when a host binds a chord, and `language.markup.startWrap()` opens it from a menu.

- `chordOf('wrapWithAbbreviation', ...)` now returns `null`. Print the chord of `surroundWithLiveTemplate` instead.
- To give it a chord, override it in `resolveKeymap`, for example `{ wrapWithAbbreviation: { mac: 'Mod+Alt+J', other: 'Mod+Alt+J' } }`, and move `surroundWithLiveTemplate`, since no two commands may share a chord.
