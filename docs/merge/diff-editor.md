# Diffs in an editor

An editor shows a diff as text, so a person can select, search and copy it. `diffDisplay` builds the text of one unified pane, `diffSplit` the texts of two side-by-side panes, and `sourceLineOf` maps a caret back to the file. All three start from a [`DiffDocument`](/merge/diff-rows).

## Unified display documents

`diffDisplay(document, unfolded?)` turns unified rows into editor text and a source map. `DiffDisplay.lines` and `rows` have one entry per display line, and `text` joins the lines with LF. Removed lines are real text. Context shows the new side.

```ts
import { diffDisplay, diffDocument, patchOf } from '@adecore/merge';

const contents = { old: 'oldName\n', new: 'newName\n' };
const document = diffDocument(patchOf(contents.old, contents.new), contents);
const display = diffDisplay(document);
// display.text is 'oldName\nnewName'; each row names its source side.
```

Each `DiffDisplayGap` has its gap `row` and a zero-based `before` position outside the text. A position equal to the line count marks a trailing gap. Draw gaps as widgets and rebuild the display when one unfolds, with the same `unfolded` map as [`diffRows`](/merge/diff-rows#gaps-and-unfolding).

`rows` point at source lines, not display positions. An empty display has no rows, while one changed blank line has one row with empty text.

## Split display documents

`diffSplit(document, unfolded?)` returns a `DiffSplit` for two synchronized editors: old and new `DiffDisplay` documents and aligned `DiffSplitRow` entries. A line entry holds a zero-based display index per side and its `DiffLineRow`. A gap entry holds its `DiffGapRow`. Each side has its own text, numbers and no-newline markers, with no placeholder lines.

```ts
import { diffSplit } from '@adecore/merge';

const split = diffSplit(document);
// split.old.text and split.new.text go into the two panes.
```

## The source line under a caret

`sourceLineOf(rows, hunks, line, character, side)` returns the `DiffSourceLine` (`line` and `column`, both from 1) of the new file that a caret on a display line stands for, or null where the new file has no line. Use it to open the file at the place a person clicked.

- `rows` are one pane's rows with both of their sides: `DiffDisplay.rows` in unified, the `row` of each `DiffSplitRow` with an `old` index for the old pane of a split.
- `hunks` are the document's.
- `side` is the text the pane shows for a changed line.

A removed line stands for the line that took its place, found within its own hunk; after the last hunk, where the file may end, it is the line before it. The column carries over only where the pane shows the new text.
