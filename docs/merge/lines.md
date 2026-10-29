# Lines and diffs

The diff and merge functions work on arrays of lines without line endings. A `TextShape` keeps the endings apart and puts them back on join.

```ts
import { diffLines, joinLines, shapeOf, splitLines } from '@adecore/merge';
import type { Change, TextShape } from '@adecore/merge';
```

## Text shape

| Function                  |                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `splitLines(text)`        | The lines of `text`, split on LF and CRLF. A final newline leaves no empty last line, and `''` gives `[]`. A lone CR stays in the line.                              |
| `shapeOf(text)`           | The `TextShape` of `text`: `{ eol: '\n' \| '\r\n', finalNewline: boolean }`. `eol` is CRLF when the first LF has a CR before it. `''` counts as ending on a newline. |
| `joinLines(lines, shape)` | The lines joined with `shape.eol`, plus one at the end when `shape.finalNewline` is set. `[]` gives `''`.                                                            |

Take the shape before you split, from the version that owns it: `shapeOf(ours)` keeps the file as it is on disk. Mixed LF and CRLF come back as one kind, and the diff does not see a change to line endings only.

## diffLines

`diffLines(base, other)` returns `Change[]` in reading order. A `Change` is `{ baseStart, baseEnd, otherStart, otherEnd }`, zero-based with exclusive ends. An insert has an empty base range, a delete an empty other range. Every range points into the original arrays, so applying the changes needs no shifting:

```ts
const base = ['first', 'old', 'last'];
const other = ['first', 'new', 'extra', 'last'];

const rebuilt: string[] = [];
let cursor = 0;
for (const change of diffLines(base, other)) {
    rebuilt.push(...base.slice(cursor, change.baseStart), ...other.slice(change.otherStart, change.otherEnd));
    cursor = change.baseEnd;
}
rebuilt.push(...base.slice(cursor));
```

Here `diffLines` returns one change, `{ baseStart: 1, baseEnd: 2, otherStart: 1, otherEnd: 3 }`. Adjacent edits come back as one change.

## Patch snapshots

`missingSides(patch)` reads a single-file patch header and returns `{ old, new }`. A side is missing when its filename is `/dev/null`. Without file headers, neither side is missing.

`patchFits(patch, oldText, newText, ignoreWhitespace)` checks that every displayed line of every hunk occurs at its coordinates in the matching snapshot. It returns `false` without a hunk or on any mismatch. Set `ignoreWhitespace` for a patch made with Git's `--ignore-all-space`.

```ts
import { missingSides, patchFits } from '@adecore/merge';

const patch = '--- a/code.ts\n+++ b/code.ts\n@@ -1 +1 @@\n-old\n+new\n';
missingSides(patch); // { old: false, new: false }
patchFits(patch, 'old\n', 'new\n', false); // true
```

`patchFits` checks the displayed lines of single-file unified hunks only. It skips hunk counts, newline markers and multi-file syntax, so never use it to authorize applying an untrusted patch.

## Parsed patches and diff rows

`parseHunkHeader(line)` reads one `@@ -a,b +c,d @@ section` line into a `HunkHeader` (one-based starts, a count of one when omitted), or returns `undefined`. `parsePatch(patch)` reads one file's unified patch into a `ParsedPatch`, with or without file headers. Each `Hunk` has zero-based `oldStart` and `newStart`, counts, section text and `PatchLine` entries (`context`, `delete` or `insert`). Carriage returns stay in the text. The line before a `\ No newline at end of file` marker gets `noNewline: true`.

`parsePatch` never throws. A truncated or malformed hunk, overlapping hunks or a multi-file patch set `partial: true`, and the recognized lines stay. Combined diffs, binary patches, rename metadata and quoted paths are not supported.

```ts
import { diffDocument, diffRows, parsePatch } from '@adecore/merge';

const parsed = parsePatch('@@ -1 +1 @@\n-old\n+new\n');
const document = diffDocument(parsed, { old: 'old\n', new: 'new\n' });
const rows = diffRows(document, 'split');
```

`diffDocument(parsed, contents, ignoreWhitespace = false)` returns a `DiffDocument`. When the snapshots match the patch, it holds every line of both files and their `TextShape`. With `ignoreWhitespace`, each side still shows its own spacing.

When snapshots are absent or do not match, the document holds only the patch lines, sets `snapshots: false` and `partial: true`, and its gaps cannot unfold. `offsets` gives where each hunk starts in the two arrays. A `DiffLineRef` has a zero-based array `index` and a one-based line `number`. Read text through `index` and label the gutter with `number`.

`diffRows(document, layout, unfolded?)` returns `DiffRow` entries in reading order. A `DiffLineRow` points at one or both sides with a `context`, `delete`, `insert` or `pair` change, an optional `hunk` and a `noNewline` of `old`, `new` or `both`. Unified rows keep patch order. Split rows pair removals with additions in each changed block.

A `DiffGapRow` stands for omitted lines, with zero-based starts and a count per side. Its `id` is the index of the next hunk, or the hunk count for the trailing gap. `unfoldable` is true only when verified snapshots hold that context. To unfold, pass `unfolded` as a `ReadonlyMap<number, number>` from gap id to the lines to reveal at each edge next to a hunk. `Infinity` reveals the whole gap.

The document and rows describe a view and do not authorize applying a patch. When `partial` is set, keep `ParsedPatch.text` for a raw view. Without snapshots, reset syntax highlighting at each hunk.

## Computed patches and word changes

`patchOf(oldText, newText, context = 3, options?)` returns a `ParsedPatch` for two complete texts. Hunks whose context touches merge. A repeated blank line at the end of a pure insertion or deletion moves to its start, so an added function includes its leading separator.

```ts
import { diffDocument, diffRows, patchOf, wordChanges } from '@adecore/merge';

const contents = { old: 'const oldName = 1;\n', new: 'const newName = 2;\n' };
const patch = patchOf(contents.old, contents.new);
const document = diffDocument(patch, contents);
const rows = diffRows(document, 'split');
const words = wordChanges(document.sides.old[0]!, document.sides.new[0]!);
```

An unchanged pair yields no hunks. An invalid `context` throws `RangeError`. A hunk whose changed block spans more than 4000 lines has `coarse: true`, so a renderer can skip word pairing. To bound the work on large input, pass `{ maxWork: 2_000_000 }` as the fourth argument. Past the limit, the unmatched middle becomes one `coarse` replacement hunk.

`wordChanges(oldLine, newLine)` returns `{ old, new }` arrays of `DiffWordRange` entries, with `from` and `to` as UTF-16 offsets, end exclusive. Whitespace changes count. It returns `null` for very long lines, so fall back to line highlighting.

## Unified display documents

`diffDisplay(document, unfolded?)` turns unified rows into editor text and a source map. `DiffDisplay.lines` and `rows` have one entry per display line, and `text` joins the lines with LF. Removed lines are real text, so an editor can select, search and copy them. Context shows the new side.

Each `DiffDisplayGap` has its gap `row` and a zero-based `before` position outside the text. A position equal to the line count marks a trailing gap. Draw gaps as widgets and rebuild the display when one unfolds. `rows` point at source lines, not display positions. An empty display has no rows, while one changed blank line has one row with empty text.

```ts
import { diffDisplay, diffDocument, patchOf } from '@adecore/merge';

const contents = { old: 'oldName\n', new: 'newName\n' };
const document = diffDocument(patchOf(contents.old, contents.new), contents);
const display = diffDisplay(document);
// display.text is 'oldName\nnewName'; each row names its source side.
```

## Split display documents

`diffSplit(document, unfolded)` returns a `DiffSplit` for two synchronized editors: old and new `DiffDisplay` documents and aligned `DiffSplitRow` entries. A line entry holds a zero-based display index per side and its `DiffLineRow`. A gap entry holds its `DiffGapRow`. Each side has its own text, numbers and no-newline markers, with no placeholder lines.

## The source line under a caret

`sourceLineOf(rows, line, character, side)` returns the `DiffSourceLine` (`line` and `column`, both from 1) of the new file that a caret on a display line stands for, or null where the new file has no line. `rows` are one pane's rows with both of their sides: `DiffDisplay.rows` in unified, the `row` of each `DiffSplitRow` with an `old` index for the old pane of a split. `side` is the text the pane shows for a changed line. A removed line stands for the line that took its place, or at the end of its hunk the line before it. The column carries over only where the pane shows the new text.

## Limits

Past 4000 edits, `diffLines` returns the whole changed middle as one change. The result still rebuilds `other`, but a three-way merge then shows that middle as one large conflict. The limit is fixed, and the call has no cancellation.
