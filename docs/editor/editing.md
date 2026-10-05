# Text and events

## Positions

The `Editor` speaks in the positions of a language server: `EditorPosition` is `{ line, character }`, zero-based, with `character` in UTF-16 code units, and `EditorRange` is `{ start, end }`. `positionAt(offset)`, `offsetAt(position)` and `textInRange(range)` convert. A position past the end of its line or of the document lands on the end.

Mount options and `revealLine` count lines from one, like a person does. Everything else counts from zero.

## Replacing the text

`setText(text)` is for a change from outside, such as a reload after the file changed on disk or an edit in another view of the same file. It applies only the lines that differ, as one undo step with the source `external`, so the caret, the scroll, the folds and the decorations stay wherever the text around them did.

`applyEdits(changes)` replaces ranges of the current text at once, as one undo step. Every range is in the text before the batch. It returns `false` and changes nothing when the editor is read-only, the list is empty, or the ranges overlap.

```ts
// 'red blue red' becomes 'green blue green'.
editor.applyEdits([
    { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, text: 'green' },
    { range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }, text: 'green' }
]);
```

The editor has no `expectedRevision`. Guard an answer that took a while with a [tracked range](#tracked-ranges).

## Change events

| Event                   | Fires when                                                                       |
| ----------------------- | -------------------------------------------------------------------------------- |
| `onTextChange(listener)` | The text changed, `setText`, undo and redo included                             |
| `onChange(listener)`     | The text changed through the editor itself; `setText` does not fire it          |
| `onCaret(listener)`      | The primary caret moved, with its new position                                  |
| `onSave(listener)`       | Mod+S was pressed in the editor                                                  |
| `onBlur(listener)`       | The focus left the editor and its own widgets                                   |
| `onViewChange(listener)` | The editor scrolled or changed size, so screen positions moved                 |
| `onHover(listener)`      | The pointer moved onto another character, with its `rect`, or `null` off the text |

Each returns a function that removes the listener. Use `onChange` for a dirty marker, since a reload should not mark the file dirty, and `onTextChange` to keep a language server in sync.

`EditorTextChange` has a `source` (`input`, `command` or `external`) and `changes`, a list of `EditorContentChange`s in order: each range is in the text the change before it left. That is the shape of `textDocument/didChange`. It is not the shape `applyEdits` takes, so a list from the event cannot be passed back as one batch.

## Selections

`getCaret()` returns the primary caret. `getSelection()` returns the primary selection with its start before its end, and `getSelections()` returns all of them, the primary one last. `setCaret(position, reveal?)`, `setSelection(range, reveal?)` and `setSelections(ranges, reveal?)` replace them and scroll the primary one into view; an empty list changes nothing.

`reveal` decides the scroll. `relative`, the default, keeps the caret in view with a line of margin. `center` puts a target that is out of view a third from the top and leaves one in view alone. `centerDown` and `centerUp` do the same while stepping through results in one direction. `revealLine(line, reveal?)` puts the caret at the start of a one-based line.

`getVisibleRange()` is the range of lines on screen, which a feature such as inlay hints asks about. `rectAt(position)` is the box of a character in page pixels, or `null` where the editor has no layout, and is the anchor for a popup. Place the popup again on `onViewChange`.

## Pointer and keys

`onClick(handler)` sees a press of the primary button on the text before the editor does. The first handler that returns `true` takes it, and the caret stays where it was. `EditorClick` carries the `position` and the `mod`, `alt` and `shift` keys. Mod and a click is how a host follows a name to its definition.

`onContextMenu(listener)` reports a request for the context menu: the `position`, whether it is `inSelection`, and `x` and `y` in page pixels. The editor draws no menu and moves no caret for it. `onKeyDown` is on [Options and keymaps](/editor/options#keymaps).

## Commands

`runCommand(command)` runs a command on every caret, the way its key would, and returns `false` when nothing changed. It takes every [command of the model](/editor-core/commands#execute) and the view's own: `collapseRegion`, `expandRegion`, `collapseAllRegions`, `expandAllRegions`, `collapseRegionRecursively`, `expandRegionRecursively`, `foldSelection`, `collapseDocComments`, `expandDocComments`, `expandAllToLevel1` through `expandAllToLevel5`, and `toggleColumnMode`.

`focus()` puts the keyboard focus in the editor.

## Tracked ranges

`trackRange(range)` returns an `EditorTrackedRange` that follows its text through every change. `get()` returns where the range is now, or `null` once an edit replaced text inside it or landed between its ends. Text inserted exactly at an end leaves it alone. A disposed range is `null`.

```ts
const original = editor.textInRange(range);
const tracked = editor.trackRange(range);

const answer = await askForReplacement(original);
const current = tracked.get();

if (current !== null) {
    editor.applyEdits([{ range: current, text: answer }]);
}

tracked.dispose();
```

Each tracked range costs one mapping of two offsets per change, so dispose it when the answer is in or abandoned.
