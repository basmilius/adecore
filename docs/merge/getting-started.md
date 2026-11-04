# Getting started

This page diffs two texts, then merges two versions of a file with their common base.

## Install

```sh
bun add @adecore/merge
```

The package has no dependencies and no peers.

## Diff two texts

`patchOf` compares two complete texts and returns a patch with three lines of context:

```ts
import { patchOf } from '@adecore/merge';

const base = 'title\nold value\nfooter\n';
const ours = 'title\nour value\nfooter\n';

const patch = patchOf(base, ours);
// One hunk: context 'title', delete 'old value', insert 'our value', context 'footer'
```

To draw it, turn it into rows with [`diffDocument` and `diffRows`](/merge/diff-rows). For the changed ranges alone, split both texts and call [`diffLines`](/merge/lines#difflines).

## Merge two versions

A three-way merge needs the base both versions started from. Split all three into lines, and sort them into blocks:

```ts
import { draftOf, joinLines, shapeOf, splitBlocks, splitLines } from '@adecore/merge';

const theirs = 'title\nold value\nfooter\nappendix\n';

const blocks = splitBlocks(splitLines(base), splitLines(ours), splitLines(theirs));
// kinds: stable, ours, stable, theirs

const merged = joinLines(draftOf(blocks).lines, shapeOf(ours));
// 'title\nour value\nfooter\nappendix\n'
```

Ours changed the middle line and theirs added a line at the end. Neither touched the other's change, so every block merges by itself. `shapeOf(ours)` keeps the line endings of our file.

## Resolve a conflict

When both sides change the same line differently, the block is a `conflict`:

```ts
import { sideLines, wandLines } from '@adecore/merge';

const other = 'title\ntheir value\nfooter\n';
const conflicted = splitBlocks(splitLines(base), splitLines(ours), splitLines(other));
// kinds: stable, conflict, stable

wandLines(conflicted[1]!);
// null: no automatic answer

const answers = new Map([[1, sideLines(conflicted[1]!, 'theirs')]]);
joinLines(draftOf(conflicted, answers).lines, shapeOf(ours));
// 'title\ntheir value\nfooter\n'
```

An answer is the lines a block becomes, keyed by block index. In an app, `wandLines` answers what it can and a person answers the rest:

```ts
import type { MergeBlock } from '@adecore/merge';

export async function merge(base: string, ours: string, theirs: string, ask: (block: MergeBlock) => Promise<string[]>): Promise<string> {
    const blocks = splitBlocks(splitLines(base), splitLines(ours), splitLines(theirs));
    const answers = new Map<number, readonly string[]>();

    for (const [index, block] of blocks.entries()) {
        if (block.kind === 'conflict') {
            answers.set(index, wandLines(block) ?? (await ask(block)));
        }
    }

    return joinLines(draftOf(blocks, answers).lines, shapeOf(ours));
}
```

[Three-way merge](/merge/three-way) explains the blocks, the wand and the draft.

## Checklist

- The shape comes from the version that owns the file, before you split it.
- Every conflict has an answer before you write the result; the draft shows an open conflict as our side.
- Store a version of each input with the answers, and ask again when one changed.
- A large comparison runs in a worker when the page must stay responsive.
