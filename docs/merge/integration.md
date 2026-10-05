# Host integration and testing

## The write boundary

The library owns line algorithms. The host owns reading three versions, identifying the destination, authenticating the resolver and writing the result. A complete flow is:

1. Read the common base and both sides with a host version token for each input. Capture the destination's `TextShape` before splitting.
2. Compute blocks once for that session. Store manual or accepted wand answers with the session identity, block index and `fingerprint`.
3. Generate drafts for display. Track unresolved conflicts separately from `openBlocks`, which always counts original conflict blocks.
4. Before saving, verify that every conflict has an answer and that the source versions still match. Recompute and ask again if they changed. A fingerprint alone does not cover base changes or hash collisions.
5. Join the final lines with the chosen shape. Have the host apply its filesystem permissions, encoding policy and atomic-write behavior.

There is no event subscription or resource to dispose in the core. A UI's workers, editor listeners, async proposals and cancellation belong to that UI. Associate async proposals with their source session before accepting them.

## Browser and backend use

The root entry point uses no Node, Bun or DOM APIs. It works in browser code and compiled Node/Bun consumers. Source imports need the `source` export condition; default imports need a built `dist`. No CSS, theme or i18n setup is required.

Use a worker for large synchronous comparisons when keeping the UI responsive matters. The core has no interruption point inside a diff.

## Migration

Replace the old algorithm imports with the root package exports. Preserve line indexing, exclusive range ends, block-kind strings, answer-map indexing and the host's output shape policy. There is no new persisted schema or wire protocol in this package.

Keep old session answers only when their input versions still match. Persisting block indices without their inputs was never a safe cross-version contract. Compare known fixtures for CRLF, missing final newlines, deletions, simultaneous inserts and overlapping changes before replacing an existing merge view.

## Checks

From the repository root:

```sh
bun run --cwd packages/merge typecheck
bun run --cwd packages/merge test
bun run --cwd packages/merge test:memory
```

The memory command uses an isolated configuration and fresh Bun processes for its two workloads. Normal tests cover reconstruction, shortest scripts within the work limit, block classification, wand behavior and text shape. The [standalone example](https://github.com/basmilius/adecore/blob/main/packages/merge/examples/resolve-conflict.ts) uses source-relative imports; package consumers should use `@adecore/merge` as in [Getting started](./getting-started).

Also exercise the host's stale-save rejection and both default compiled and source imports. Passing algorithm tests does not verify an application's file writer.

## Troubleshooting

| Symptom                                      | Cause and next step                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A conflict vanished from the draft           | Unanswered conflicts show ours without markers. Check the answers map before saving.                                       |
| Conflict count stays nonzero after answering | `openBlocks` inspects block kinds. Count unanswered conflict indices yourself.                                             |
| A whole middle stretch becomes one conflict  | The diff exceeded its edit-distance limit. Reconstruction remains correct; offer a broader manual edit.                    |
| The saved file changes every line            | Preserve the destination's EOL/final-newline shape and original encoding in the host. Mixed separators need a host policy. |
| A manual answer lands in the wrong place     | Inputs changed and block indices moved. Rebuild the session instead of replaying index-only answers.                       |
| Editor decorations drift after typing        | Draft spans do not track edits. Update editor ranges or regenerate the draft.                                              |
| A wand proposal changes meaning              | The wand compares text, including whitespace inside literals. Review or validate proposals in the host.                    |
