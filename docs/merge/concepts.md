# Lines, ranges and blocks

## Text shape is separate from line content

`splitLines` removes LF and CRLF separators and drops the empty array entry left by a final newline. Empty text becomes `[]`. It leaves lone carriage returns in the line content.

`shapeOf` records `eol` and `finalNewline`. It chooses CRLF when the first LF has a preceding carriage return; otherwise it chooses LF. Empty text has `finalNewline: true`, but joining an empty line array still returns `''`.

`joinLines(lines, shape)` puts all lines back with one separator style. It preserves a uniformly LF or CRLF file and its final-newline choice. A file with mixed separators becomes uniform. A host that must preserve mixed separators or original byte encoding needs a richer representation around these helpers.

Decide which input owns the output shape. Using `shapeOf(ours)` preserves the destination's convention; using the base may be appropriate for a repository policy. The algorithms do not choose it for you, and newline-only changes are absent from line comparisons.

## Changed ranges

`diffLines(base, other)` returns ordered `Change` records. `baseStart` and `baseEnd` identify the replaced range in the base; `otherStart` and `otherEnd` identify its replacement in the other version. Ends are exclusive.

| Change  | Base range              | Other range |
| ------- | ----------------------- | ----------- |
| Insert  | Empty, such as `[1, 1)` | Added lines |
| Delete  | Removed lines           | Empty       |
| Replace | Removed lines           | New lines   |

Ranges refer to the original arrays, not a progressively edited array. This reconstruction uses them without shifting later offsets:

```ts
import { diffLines } from '@adecore/merge';

const base = ['first', 'old', 'last'];
const other = ['first', 'new', 'extra', 'last'];
const rebuilt: string[] = [];
let cursor = 0;
for (const change of diffLines(base, other)) {
    rebuilt.push(...base.slice(cursor, change.baseStart));
    rebuilt.push(...other.slice(change.otherStart, change.otherEnd));
    cursor = change.baseEnd;
}
rebuilt.push(...base.slice(cursor));
console.log(JSON.stringify(rebuilt) === JSON.stringify(other));
```

## Three-way blocks

`splitBlocks(base, ours, theirs)` compares each side with the base, then groups overlapping changes into reading-order blocks. Two insertions at the same base position belong to one block. Separate adjacent changes need not be one conflict; overlaps can grow transitively into a larger stretch.

| `MergeBlockKind` | Relationship              | Automatic lines |
| ---------------- | ------------------------- | --------------- |
| `stable`         | Both sides equal the base | Ours            |
| `ours`           | Only ours changed         | Ours            |
| `theirs`         | Only theirs changed       | Theirs          |
| `both`           | Both made the same change | Ours once       |
| `conflict`       | Both changed differently  | None            |

Each `MergeBlock` contains actual `base`, `ours` and `theirs` line arrays. It carries no original source offsets. Empty stretches are omitted, so three empty inputs produce no blocks. Inputs are not mutated.

## Work and memory limits

The diff trims matching prefixes and suffixes before its Myers walk. Within the walk's edit-distance limit of `4000`, it computes a shortest insert/delete script. It checkpoints every 64 rounds and recomputes intermediate rounds during backtracking to avoid keeping the full history.

When the remaining inputs exceed that distance, the result is one replacement range for the differing middle. Matching prefixes and suffixes remain outside it. Reconstruction stays correct, but conflict granularity becomes coarser. This is a work limit, not a 4000-line file-size limit, and it is not a configurable public option.

The calls are synchronous. They have no cancellation or streaming interface, and arrays and result strings still consume memory. A host may impose input-size limits or move expensive work to a worker. The [memory regression tests](https://github.com/basmilius/adecore/blob/main/packages/merge/src/diff-memory.integration.test.ts) verify specific workloads in fresh Bun processes; they are not a universal memory guarantee.
