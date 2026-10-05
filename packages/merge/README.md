# @adecore/merge

Pure line diffs, three-way merge blocks and conflict resolution. It uses no filesystem, Git process, editor or browser API.

The package is private at `0.0.0` pending initial publication. Use this checkout through a workspace/link with the `source` export condition, or build it for default JavaScript/declaration imports from `dist`. The transferred code retains FSL-1.1-MIT in [LICENSE](./LICENSE).

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

The fixed answer above represents a caller's completed decision. Unanswered draft conflicts use ours without markers; saving requires a separate unresolved check. Preserve text shape and verify input versions before writing. The host owns authorization, file access and stale-answer rejection.

Read the [overview](https://adecore.dev/merge/), [getting started](https://adecore.dev/merge/getting-started), [line/block concepts](https://adecore.dev/merge/concepts), [resolution guide](https://adecore.dev/merge/resolution), [API reference](https://adecore.dev/merge/api) and [integration/testing guide](https://adecore.dev/merge/integration).

From the repository root, run `bun run --cwd packages/merge test`, `typecheck` or `build`. The isolated `test:memory` command checks bounded diff memory workloads. A source-relative example is in [examples/resolve-conflict.ts](./examples/resolve-conflict.ts).
