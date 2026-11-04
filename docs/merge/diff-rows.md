# Diff rows

A diff view draws rows: context, removed and added lines, and gaps for the lines a patch leaves out. `diffDocument` joins a patch with the two versions, and `diffRows` turns that into rows for a unified or a split layout.

```ts
import { diffDocument, diffRows, parsePatch } from '@adecore/merge';

const parsed = parsePatch('@@ -1 +1 @@\n-old\n+new\n');
const document = diffDocument(parsed, { old: 'old\n', new: 'new\n' });
const rows = diffRows(document, 'split');
```

## The document

`diffDocument(parsed, contents, ignoreWhitespace = false)` returns a `DiffDocument`. When the snapshots match the patch, it holds every line of both files and their `TextShape`. With `ignoreWhitespace`, each side still shows its own spacing.

When snapshots are absent or do not match, the document holds only the patch lines, sets `snapshots: false` and `partial: true`, and its gaps cannot unfold. `offsets` gives where each hunk starts in the two arrays. A `DiffLineRef` has a zero-based array `index` and a one-based line `number`. Read text through `index` and label the gutter with `number`.

## Rows

`diffRows(document, layout, unfolded?)` returns `DiffRow` entries in reading order. A `DiffLineRow` points at one or both sides with a `context`, `delete`, `insert` or `pair` change, an optional `hunk` and a `noNewline` of `old`, `new` or `both`. Unified rows keep patch order. Split rows pair removals with additions in each changed block.

```tsx
for (const row of rows) {
    if (row.kind === 'line') {
        const oldText = row.old && document.sides.old[row.old.index];
        const newText = row.new && document.sides.new[row.new.index];
        // Draw row.old?.number and row.new?.number in the gutter, and the text by row.change.
    }
}
```

## Gaps and unfolding

A `DiffGapRow` stands for omitted lines, with zero-based starts and a count per side. Its `id` is the index of the next hunk, or the hunk count for the trailing gap. `unfoldable` is true only when verified snapshots hold that context.

To unfold, pass `unfolded` as a `ReadonlyMap<number, number>` from gap id to the lines to reveal at each edge next to a hunk. `Infinity` reveals the whole gap:

```ts
const unfolded = new Map([[0, 10], [1, Infinity]]);
const more = diffRows(document, 'unified', unfolded);
```

The document and rows describe a view and do not authorize applying a patch. When `partial` is set, keep `ParsedPatch.text` for a raw view. Without snapshots, reset syntax highlighting at each hunk.

## Word changes

`wordChanges(oldLine, newLine)` returns `{ old, new }` arrays of `DiffWordRange` entries, with `from` and `to` as UTF-16 offsets, end exclusive. Use it to highlight the changed words in a `pair` row:

```ts
import { diffDocument, diffRows, patchOf, wordChanges } from '@adecore/merge';

const contents = { old: 'const oldName = 1;\n', new: 'const newName = 2;\n' };
const document = diffDocument(patchOf(contents.old, contents.new), contents);
const words = wordChanges(document.sides.old[0]!, document.sides.new[0]!);
```

Whitespace changes count. It returns `null` for very long lines, so fall back to line highlighting. Skip it for a hunk with `coarse: true`.

For an editor that shows a diff as text, see [Diffs in an editor](/merge/diff-editor).
