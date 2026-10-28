# Text and events

## Positions

The `Editor` uses language server positions. `EditorPosition` is `{ line, character }`, zero-based, with `character` in UTF-16 code units, and `EditorRange` is `{ start, end }`. `positionAt(offset)`, `offsetAt(position)` and `textInRange(range)` convert. A position past the end of its line or document clamps to the end.

Mount options and `revealLine` count lines from one. Everything else counts from zero.

## Replacing the text

`setText(text)` is for outside changes, such as a reload from disk or an edit in another view of the file. It applies only the differing lines as one `external` undo step, so caret, scroll, folds and decorations stay with their text.

`applyEdits(changes, options?)` replaces ranges of the current text as one undo step. Every range refers to the text before the batch. It returns `false` and changes nothing when the editor is read-only, the list is empty or ranges overlap. `editor.isReadOnly()` reports the read-only state; it is optional on `Editor`, so a wrapper checks `editor.isReadOnly?.() ?? false`.

```ts
// 'red blue red' becomes 'green blue green'.
editor.applyEdits([
    { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, text: 'green' },
    { range: { start: { line: 0, character: 9 }, end: { line: 0, character: 12 } }, text: 'green' }
]);
```

`EditorApplyEditsOptions`:

- `mapSelections` maps each current selection, as a start-before-end range, to its place in the new text. Selections keep their direction. Without it, selections follow the edits.
- `mergeUndo: true` joins the edits to the previous undo step when the text is exactly as that step left it, such as formatting after a typed character.

The editor has no `expectedRevision`. Guard a slow answer with a [tracked range](#tracked-ranges).

## Saving

`cleanUpWhitespace(options)` runs right before the host writes the file. It applies the `EditorWhitespaceCleanup` options (the [model's options](/editor-core/documents#saving) without `language`) as one undo step, then marks the text saved, so `trailingWhitespace: 'modified'` counts from the last save. Call it on every save, even with everything off. `markSaved()` marks the text saved without cleanup, such as after a reload. Both are optional on `Editor` and do nothing when read-only.

```ts
editor.onSave(() => {
    editor.cleanUpWhitespace({ trailingWhitespace: 'modified' });
    writeFile(path, editor.getText());
});
```

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

Each returns an unsubscribe function. Use `onChange` for a dirty marker, since a reload should not mark the file dirty, and `onTextChange` to keep a language server in sync.

`EditorTextChange` has a `source` (`input`, `command` or `external`), `typed` when typing caused a command such as Enter, and `changes`: `EditorContentChange`s in order, each relative to the text the previous one left. That is the shape of `textDocument/didChange`, not of `applyEdits`, so the list cannot be passed back as one batch.

## Selections

`getCaret()` returns the primary caret. `getSelection()` returns the primary selection, start before end, and `getSelections()` returns all of them, primary last. `setCaret(position, reveal?)`, `setSelection(range, reveal?)` and `setSelections(ranges, reveal?)` replace them and scroll the primary into view. An empty list changes nothing.

`reveal` sets the scroll. `relative` (default) keeps the caret in view with a line of margin. `center` puts an off-screen target a third from the top. `centerDown` and `centerUp` do the same while stepping through results in one direction. `revealLine(line, reveal?)` puts the caret at the start of a one-based line.

`getVisibleRange()` returns the lines on screen. `rectAt(position)` returns a character's box in page pixels, or `null` without layout, as a popup anchor. Reposition the popup on `onViewChange`.

## Pointer and keys

`onClick(handler)` sees a primary-button press on the text before the editor. The first handler returning `true` takes it, and the caret stays put. `EditorClick` carries the `position` and the `mod`, `alt` and `shift` keys, for example to follow Mod+click to a definition.

`onContextMenu(listener)` reports a context menu request: the `position`, whether it is `inSelection`, and `x` and `y` in page pixels. The editor draws no menu and keeps the caret. `onKeyDown` is on [Options and keymaps](/editor/options#keymaps).

## Commands

`runCommand(command)` runs a command on every caret, as its key would, and returns `false` when nothing changed. It takes every [model command](/editor-core/commands#execute) and the view's own: `collapseRegion`, `expandRegion`, `collapseAllRegions`, `expandAllRegions`, `collapseRegionRecursively`, `expandRegionRecursively`, `foldSelection`, `collapseDocComments`, `expandDocComments`, `expandAllToLevel1` through `expandAllToLevel5`, `toggleColumnMode`, and the [zoom](/editor/options#zoom) commands `increaseFontSize`, `decreaseFontSize` and `resetFontSize`.

`focus()` puts the keyboard focus in the editor.

## Tracked ranges

`trackRange(range)` returns an `EditorTrackedRange` that follows its text. `get()` returns where the range is now, or `null` once an edit touched its inside or after `dispose()`. Text inserted exactly at an end leaves it alone.

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

Dispose a tracked range once the answer is in or abandoned, since each one costs work on every change.
