# @adecore/merge

Pure line diffs, three-way merge blocks and conflict resolution. It uses no filesystem, Git process, editor or browser API.

```sh
bun add @adecore/merge
```

Licensed under FSL-1.1-MIT, see [LICENSE](./LICENSE).

```ts
import { draftOf, joinLines, shapeOf, splitBlocks, splitLines } from '@adecore/merge';

const base = 'first\r\nold\r\n';
const ours = 'first\r\nours\r\n';
const theirs = 'first\r\ntheirs\r\n';
const blocks = splitBlocks(splitLines(base), splitLines(ours), splitLines(theirs));
const answers = new Map<number, readonly string[]>();
for (const [index, block] of blocks.entries()) {
    if (block.kind === 'conflict') {
        answers.set(index, ['combined']);
    }
}
const text = joinLines(draftOf(blocks, answers).lines, shapeOf(ours));
```

The answer in the example stands for a decision the caller already made. A draft takes ours, without markers, for every conflict that has no answer yet, so check for unresolved conflicts separately before saving. Keep the shape of the text, and check that the inputs are still the versions you read before writing. Authorization, file access and refusing a stale answer are the host's.

Read the [overview](https://adecore.dev/merge/), [lines and diffs](https://adecore.dev/merge/lines) and [three-way merge](https://adecore.dev/merge/three-way).

From the repository root, run `bun run --cwd packages/merge test`, `typecheck` or `build`. `test:memory` runs on its own and checks that a diff of two large files stays under 20 MB. [examples/resolve-conflict.ts](./examples/resolve-conflict.ts) is a whole example that imports the source.
