# Merge

`@adecore/merge` diffs, patches and merges text by line. A three-way merge sorts a base and two versions into blocks that merge by themselves and blocks a person decides, then builds the file from the answers. A diff becomes rows for a view or text for an editor. The package does no I/O and needs no DOM, so it runs in a page and in a backend.

## What it does

- Splits text into lines and joins it back with the original line endings.
- Diffs two arrays of lines, and computes a unified patch with context from two texts.
- Parses a unified patch, and checks that it fits the two versions it claims to describe.
- Turns a patch into rows for a unified or split view, with gaps that unfold, and highlights the changed words in a line.
- Builds editor text for one or two diff panes, and maps a caret back to the file.
- Sorts a three-way merge into blocks, answers the easy conflicts and builds an editable draft.

## What it leaves to the app

Every function is synchronous and keeps no state. The app reads the versions, decides who may resolve a conflict, shows the blocks and writes the result. A large comparison blocks its thread, so run it in a worker when the page must stay responsive.

## Where to next

- [Getting started](/merge/getting-started) diffs two texts and merges two versions of a file.
- [Lines and diffs](/merge/lines) covers line endings and `diffLines`.
- [Patches](/merge/patches) covers parsing, checking and computing unified patches.
- [Diff rows](/merge/diff-rows) covers the rows of a diff view, gaps and word changes.
- [Diffs in an editor](/merge/diff-editor) covers text for one or two editor panes.
- [Three-way merge](/merge/three-way) covers blocks, automatic answers, the draft and what to check before saving.
- [Reference](/merge/reference) lists the limits and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/merge/LICENSE).
