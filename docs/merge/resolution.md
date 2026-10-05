# Choosing a resolution

## Automatic choices and the wand

`autoLines(block)` returns a fresh array for stable, one-sided and identical changes. It returns `null` for a conflict. An empty array is a valid automatic deletion; test against `null`, not array length.

`wandLines` also proposes answers for two kinds of textual conflict:

- Equivalent lines after collapsing internal whitespace and removing trailing whitespace. Leading indentation remains significant on nonblank lines; a tab is not four spaces. Blank-line indentation does not matter. Ours wins an equivalent-whitespace comparison.
- One side contains the other's exact lines as a contiguous run and its extra lines do not restore base lines the other side deleted. An empty inner side is not a superset match.

The wand is a text heuristic. It does not parse a language, understand string literals or validate the resulting program. Decide whether a host should accept these suggestions automatically or offer them for review. A `null` answer means a person or another host decision is still required.

## Manual choices

`sideLines(block, 'ours' | 'theirs')` copies one side. `bothLines(block, first)` concatenates the selected side followed by the other side. It does not deduplicate identical lines or validate their order. Use it when both additions belong in the result, rather than for every conflicting replacement.

A custom answer is simply an array of lines. An empty array deletes the entire block. Store these arrays in a `Map<number, readonly string[]>` keyed by the block's index.

```ts
import { bothLines, draftOf, sideLines, splitBlocks } from '@adecore/merge';

const blocks = splitBlocks(['start', 'end'], ['start', 'our import', 'end'], ['start', 'their import', 'end']);
const index = blocks.findIndex((block) => block.kind === 'conflict');
if (index < 0) {
    throw new Error('Expected an insertion conflict');
}
const block = blocks[index]!;
const oursOnly = sideLines(block, 'ours');
const answers = new Map([[index, bothLines(block, 'ours')]]);
console.log(oursOnly);
console.log(draftOf(blocks, answers).lines);
```

## Editable drafts and spans

`draftOf` builds a new `MergeDraft`. For each block, it uses an explicit answer first, then automatic lines, then our side for an unresolved conflict. It inserts no conflict markers. An answer can override any kind of block, not only a conflict; out-of-range map keys are unused.

`MergeSpan` describes where each block landed with `block`, original `kind`, `from` and exclusive `to`. Replacement lengths affect all later draft offsets. A deletion has `from === to` and still receives a span.

Spans describe that particular generated draft. Editing the line array in an editor does not update spans, and applying an answer does not change a span's `kind` from `conflict`. Track resolution status and editor-range changes in the host. Rebuild spans whenever generating a new draft.

## Stale answers

`fingerprint(block)` returns an eight-character hexadecimal value derived from ours and theirs. It is deterministic in a browser and backend. It is not cryptographic, does not include the base or kind, and is not a durable block id.

An answer needs a file/session identity and version token as well as a block index and fingerprint. Recomputing blocks after an input change can change their indices. Do not replay an old map by index alone. The [integration guide](./integration) describes the write boundary.
