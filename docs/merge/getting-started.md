# Getting started

Start with the common base, our version and their version as strings. Capture the text shape before splitting. This example chooses a custom answer for the remaining conflict and refuses to reconstruct a final result while any conflict lacks an answer.

```ts
import { autoLines, draftOf, fingerprint, joinLines, openBlocks, shapeOf, splitBlocks, splitLines, wandLines } from '@adecore/merge';

const base = 'title\r\nold value\r\nfooter\r\n';
const ours = 'title\r\nour value\r\nfooter\r\n';
const theirs = 'title\r\ntheir value\r\nfooter\r\n';
const shape = shapeOf(ours);
const blocks = splitBlocks(splitLines(base), splitLines(ours), splitLines(theirs));
const answers = new Map<number, readonly string[]>();
const stamps = new Map<number, string>();

for (const [index, block] of blocks.entries()) {
    if (autoLines(block) !== null) {
        continue;
    }
    const suggested = wandLines(block);
    if (suggested !== null) {
        answers.set(index, suggested);
    } else {
        answers.set(index, ['combined value']);
    }
    stamps.set(index, fingerprint(block));
}

const unresolved = blocks.filter((block, index) => block.kind === 'conflict' && !answers.has(index));
if (unresolved.length > 0) {
    throw new Error('Resolve every conflict before saving');
}
for (const [index, stamp] of stamps) {
    if (fingerprint(blocks[index]!) !== stamp) {
        throw new Error('The conflict changed');
    }
}

const draft = draftOf(blocks, answers);
const resolved = joinLines(draft.lines, shape);
console.log(openBlocks(blocks));
console.log(resolved === 'title\r\ncombined value\r\nfooter\r\n');
console.log(draft.spans);
```

The output reports one original conflict and `true`. `openBlocks` counts the input block kinds; it does not inspect the answers map. The replacement occupies lines `[1, 2)` in the draft. Block indices and line indices start at zero.

The custom answer represents a decision already made by the caller. In an interactive host, present the block, collect the answer and record its fingerprint instead of assigning a fixed replacement.

`draftOf(blocks)` is useful before resolution is complete. It uses our lines for conflicts and merges the rest. That default is a preview, so saving needs the explicit unresolved check above.

## Use the checkout

In a workspace consumer, declare the local package dependency and let the workspace resolve `@adecore/merge`. For source use, add `source` to your bundler's export conditions and TypeScript's `customConditions`; Bun accepts `--conditions=source`. Do not add application aliases to the library.

For compiled use, build from the Adecore repository root:

```sh
bun run --cwd packages/merge build
```

Default imports then resolve JavaScript and declarations in `dist`. No public npm release is assumed by this example. Continue with [Lines, ranges and blocks](./concepts) before connecting the result to a file writer.

TypeScript checking of the source entry point uses `moduleResolution: 'bundler'`, `customConditions: ['source']` and `allowImportingTsExtensions: true`. A compiled Node consumer can use `NodeNext` resolution without the source condition.
