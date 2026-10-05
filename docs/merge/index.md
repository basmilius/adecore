# @adecore/merge

Line diffs and three-way merge decisions for text. The package takes arrays of lines and returns changed ranges, merge blocks and editable drafts. It has no editor, filesystem, Git process or browser dependency.

Use it when a host already has a common base and two versions of a file. Independent changes merge automatically. Conflicts remain explicit decisions even though the draft contains valid text without conflict markers.

The package is private at `0.0.0` pending initial publication. Work from the local checkout; the compiled entry point reads `dist`, and the `source` export condition reads TypeScript. The transferred code retains [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/merge/LICENSE).

## Read the documentation

- [Getting started](./getting-started) resolves a conflict and reconstructs CRLF text.
- [Lines, ranges and blocks](./concepts) explains text shape, block classification and algorithm limits.
- [Choosing a resolution](./resolution) covers automatic choices, the wand, manual answers and draft spans.
- [API reference](./api) groups every public function and type.
- [Host integration and testing](./integration) covers stale answers, persistence, migration and troubleshooting.

The [standalone example](https://github.com/basmilius/adecore/blob/main/packages/merge/examples/resolve-conflict.ts) runs without a UI. A host supplies file access, permission checks, an editor and any AI proposal flow.
