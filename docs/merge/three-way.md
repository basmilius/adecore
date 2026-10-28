# Three-way merge

A three-way merge compares two versions with their common base. Where one side changed a stretch, that change wins. Where both changed it differently, a person decides.

```ts
import { bothLines, draftOf, fingerprint, sideLines, splitBlocks, wandLines } from '@adecore/merge';
import type { MergeBlock, MergeBlockKind, MergeDraft, MergeSide, MergeSpan } from '@adecore/merge';
```

## Blocks

`splitBlocks(base, ours, theirs)` returns the file as `MergeBlock[]` in reading order. A block is `{ kind, base, ours, theirs }`, with each version's lines for that stretch. Three empty inputs give `[]`.

| `MergeBlockKind` | Means | Merges to |
| --- | --- | --- |
| `stable` | Neither side changed it | Ours |
| `ours` | Only ours changed it | Ours |
| `theirs` | Only theirs changed it | Theirs |
| `both` | Both made the same change | Ours, once |
| `conflict` | Both changed it, differently | Nothing until someone answers |

Changes from both sides form one block where they overlap in the base or insert at the same line. Changes that only touch stay separate blocks.

## Answers

An answer is the lines a block becomes, in a `Map<number, readonly string[]>` keyed by block index. `[]` deletes the stretch.

| Function | Returns |
| --- | --- |
| `sideLines(block, side)` | A copy of one side. `MergeSide` is `'ours' \| 'theirs'`. |
| `bothLines(block, first)` | Both sides, `first` before the other, for two additions that both belong. Duplicates stay. |
| `wandLines(block)` | For a non-conflict, the lines it merges to. For a conflict, an answer in the two cases below, else `null`. Test for `null`, since a deletion is `[]`. |

The wand answers a conflict when:

- Both sides hold the same lines. Ours wins.
- One side holds the other's lines as one run and restores no base line the other deleted. That side wins. An empty side never counts as held.

It compares plain text, so any whitespace difference returns `null` and needs a manual choice.

## Drafts

`draftOf(blocks, answers?)` builds the merged file as a `MergeDraft`, `{ lines, spans }`. Each block takes its answer, else the lines it merges to, and an unanswered conflict takes our side. The draft has no conflict markers, so a person can edit it as a file. An answer may replace a block of any kind.

A `MergeSpan` is `{ block, kind, from, to }`: a block's index and kind and its lines in the draft, `to` exclusive. A deleted block has a span with `from` equal to `to`. Spans describe the draft as built. Edits do not move them, and an answered conflict keeps `kind: 'conflict'`. Build a new draft after each answer, or track the ranges in the editor.

## Before saving

An open conflict looks finished in the draft, so check before you write:

```ts
const unanswered = blocks.flatMap((block, index) => (block.kind === 'conflict' && !answers.has(index) ? [index] : []));
if (unanswered.length > 0) {
    throw new Error(`${unanswered.length} conflicts have no answer`);
}
```

When an input changes, block indices can shift and a stored answer lands on the wrong stretch. Store a version of each input with the answers, and ask again when one changed.

`fingerprint(block)` returns eight hex characters from a block's two sides, the same in a browser and a backend. Store it with an answer and compare before applying it. It is not cryptographic and skips the base, so it catches a moved block but does not replace the version check.
