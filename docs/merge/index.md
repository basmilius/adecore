# @adecore/merge

Line diffs, patches and three-way merges for text. A merge sorts a base and two versions into blocks that merge by themselves and blocks a person decides, then builds the file from the answers. It does no I/O and needs no DOM, so it runs in a page and in a backend.

```sh
bun add @adecore/merge
```

```ts
import { draftOf, joinLines, shapeOf, splitBlocks, splitLines, wandLines, type MergeBlock } from '@adecore/merge';

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

With `base` as `'title\r\nold value\r\nfooter\r\n'`, `ours` changing the middle line to `our value` and `theirs` to `their value`, `splitBlocks` returns a `stable`, a `conflict` and a `stable` block. If `ask` answers `['combined value']`, the result is `'title\r\ncombined value\r\nfooter\r\n'`, with the line endings of `ours`.

- [Lines and diffs](/merge/lines): lines and line endings, diffs, patches and diff displays.
- [Three-way merge](/merge/three-way): blocks, automatic answers, the editable draft and what to check before saving.

## What the app owns

Every function is synchronous and keeps no state. The app reads the versions, decides who may resolve a conflict, shows the blocks and writes the result. A large comparison blocks its thread, so run it in a worker when the page must stay responsive.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/merge/LICENSE).
