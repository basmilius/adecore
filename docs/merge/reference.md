# Reference

```ts
import { diffLines, draftOf, patchOf, splitBlocks, splitLines } from '@adecore/merge';
```

## Limits

| Limit                   | Value                  | What happens past it                                                     | Explained in                              |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| Edits in one diff       | 4000, fixed            | The changed middle becomes one change, or one `coarse` hunk in `patchOf` | [Lines and diffs](/merge/lines#limits)    |
| Changed lines in a hunk | 4000                   | The hunk gets `coarse: true`                                             | [Patches](/merge/patches#computed-patches) |
| `maxWork` of `patchOf`  | None unless you pass one | The unmatched middle becomes one `coarse` hunk                         | [Patches](/merge/patches#computed-patches) |
| Line length for `wordChanges` | Very long lines  | It returns `null`                                                        | [Diff rows](/merge/diff-rows#word-changes) |

## Block kinds

| `MergeBlockKind` | Merges to                     |
| ---------------- | ----------------------------- |
| `stable`         | Ours                          |
| `ours`           | Ours                          |
| `theirs`         | Theirs                        |
| `both`           | Ours, once                    |
| `conflict`       | Nothing until someone answers |

[Three-way merge](/merge/three-way#blocks) explains each kind.

## Exports

Every name `@adecore/merge` exports, read from its source. Anything not listed is internal and may change in any release.

### `@adecore/merge`

Lines, diffs, patches, diff rows and displays, and the three-way merge.

<ExportTable entry="@adecore/merge" />
