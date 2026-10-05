# API reference

All names below are exported by `@adecore/merge`. There are no public subpaths or runtime dependencies. Functions are synchronous and do not perform I/O.

## Text

| Export       | Signature or shape                                     | Behavior                                  |
| ------------ | ------------------------------------------------------ | ----------------------------------------- |
| `TextShape`  | `{ eol: '\n' \| '\r\n'; finalNewline: boolean }`       | Output separator and final newline policy |
| `shapeOf`    | `(text: string): TextShape`                            | Uses the first LF to choose the separator |
| `splitLines` | `(text: string): string[]`                             | Splits LF/CRLF; empty input produces `[]` |
| `joinLines`  | `(lines: readonly string[], shape: TextShape): string` | Empty arrays produce empty text           |

See [Text shape](./concepts#text-shape-is-separate-from-line-content) for mixed separators and lone CR characters.

## Diff and blocks

| Export           | Signature or shape                                                           | Behavior                               |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| `Change`         | `{ baseStart; baseEnd; otherStart; otherEnd }`, all numbers                  | Zero-based ranges with exclusive ends  |
| `diffLines`      | `(base: readonly string[], other: readonly string[]): Change[]`              | Ordered differing ranges               |
| `MergeBlockKind` | `'stable' \| 'ours' \| 'theirs' \| 'both' \| 'conflict'`                     | Relationship of the three versions     |
| `MergeBlock`     | `{ kind: MergeBlockKind; base: string[]; ours: string[]; theirs: string[] }` | One stretch in reading order           |
| `splitBlocks`    | `(base, ours, theirs: readonly string[]): MergeBlock[]`                      | Three-way block classification         |
| `openBlocks`     | `(blocks: readonly MergeBlock[]): number`                                    | Counts blocks whose kind is `conflict` |

## Answers and drafts

| Export        | Signature or shape                                                                               | Behavior                                                      |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `MergeSide`   | `'ours' \| 'theirs'`                                                                             | Choice of side                                                |
| `sideLines`   | `(block: MergeBlock, side: MergeSide): string[]`                                                 | Fresh copy of that side                                       |
| `bothLines`   | `(block: MergeBlock, first: MergeSide): string[]`                                                | Both sides concatenated in that order                         |
| `autoLines`   | `(block: MergeBlock): string[] \| null`                                                          | `null` for conflicts                                          |
| `wandLines`   | `(block: MergeBlock): string[] \| null`                                                          | Automatic or conservative textual proposal                    |
| `fingerprint` | `(block: MergeBlock): string`                                                                    | Noncryptographic fingerprint of the two sides                 |
| `MergeSpan`   | `{ block: number; kind: MergeBlockKind; from: number; to: number }`                              | Block range in a generated draft                              |
| `MergeDraft`  | `{ lines: string[]; spans: MergeSpan[] }`                                                        | Editable content and its initial ranges                       |
| `draftOf`     | `(blocks: readonly MergeBlock[], answered?: ReadonlyMap<number, readonly string[]>): MergeDraft` | Answers override automatic lines; conflicts fall back to ours |

The default `answered` map is empty. Arrays returned by the helpers are fresh, but the types are not frozen. No helper authenticates an answer or checks a source revision.

Implementation: [text](https://github.com/basmilius/adecore/blob/main/packages/merge/src/text.ts), [diff](https://github.com/basmilius/adecore/blob/main/packages/merge/src/diff.ts), [blocks](https://github.com/basmilius/adecore/blob/main/packages/merge/src/blocks.ts) and [resolution](https://github.com/basmilius/adecore/blob/main/packages/merge/src/resolve.ts).
