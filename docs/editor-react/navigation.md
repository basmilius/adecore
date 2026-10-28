# Navigation

<Demo src="editor/navigation" />

## Going to a definition

`language.navigation.go(kind, position?)` asks for the `definition`, `declaration`, `typeDefinition` or `implementation` at the caret. One result moves the caret there, in this file or through the host's `openPlace`. Several open a pick list with a preview of each. Mod+click on a name goes to its definition, and holding Mod underlines the name under the pointer.

`language.pick.open(spec)` opens that list for any choice: an anchor position, a title, groups of rows and `accept(id)`. Up and Down move, Enter accepts, Escape closes. Optional fields:

| Field           | Effect                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `filter: true`  | Typing narrows rows by their `search` (or label), case-insensitively, and shows the query in the title         |
| `multiple: true` | Shift with the arrows or a click picks a run, Mod+click toggles one; Enter calls `acceptMany(ids)` in list order, or `accept` without it |
| `remove(ids)`   | Handles Delete, and Backspace on an empty query; returns the remaining groups, and the list closes when none remain |
| `onTab(backwards)` | Closes the list and passes Tab on                                                                           |

A `PickRow` with a one-character `mnemonic` shows it in a column; typing it picks the row in a list without `filter`. A `PickPreview` with `kind: 'text'` draws `added` as plain lines. The popup draws a `PickView`, with the `query` (null without `filter`) and the `chosen` ids.

## Peek

`language.peek.open(position?)` shows the references of a name in a panel between the editor's lines, grouped by file, with the code of the selected one. `peek.openDefinition(position?)` does the same for definitions. The arrow keys pick a place, Enter goes there, Escape closes. Other files are read through the project's [`files`](/editor-react/project#workspace-edits), at most 30 per peek. Dragging the bottom edge, or the arrow keys, Home or End on it, resizes the panel; `panelBodyHeight` and `onPanelResize` on the [host](/editor-react/project#languagehost) keep the height, which the call hierarchy shares. The panel lives in an editor widget row and scrolls with the text.

`language.callHierarchy.open()` opens the same panel for callers and callees; see [call hierarchy](/editor-react/call-hierarchy).

## Symbols

`language.symbols` passes every symbol to the editor with `setDeclarations`, so they are the stops of Method Up and Down. Those jumps are recorded in the history.

`language.symbolPicker.open()` (Mod+F12) filters the document's symbols. `:12` goes to line 12, and `#name` searches the project through `workspace/symbol` where supported.

## History

Every jump records the caret's place in the project's `NavigationHistory`, shared by all its editors, so Back and Forward cross files. Places on one line count as one, and it keeps the last 100. `language.history.back()` and `forward()` (Mod+[ and Mod+] on a Mac) move through it, and `recent()` lists the places in a pick list.

A host that moves the caret itself uses `NavigationHistory` directly: `record(from)`, `back(current)`, `forward(current)`, `canGoBack(current)`, `canGoForward(current)` and `recent(current)`, all with `Place`s of a `uri` and a `position`.

## Edit locations

`project.edits`, an `EditLocations`, remembers where a person edited. Each `EditPlace` holds the `uri` and the selections, primary last. Edits within three lines of the last place, with as many carets, count as one place. It keeps 150 places, or `LanguageHost.editHistoryLimit`. Places follow later edits of their file (`map`), and `didDeleteFiles` drops those of deleted files (`forget`). Edits from outside the editor add none, and nothing persists between sessions.

`language.history.lastEdit()` and `nextEdit()` walk the places, skipping the current one. In the same file they restore every caret; another file opens through `openPlace` on the primary caret only. Neither touches the Back and Forward history. The keymap ids are `lastEditLocation` (`Mod+Shift+Backspace`) and `nextEditLocation`, which has no chord.
