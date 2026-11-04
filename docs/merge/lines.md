# Lines and diffs

The diff and merge functions work on arrays of lines without line endings. A `TextShape` keeps the endings apart and puts them back on join.

```ts
import { diffLines, joinLines, shapeOf, splitLines } from '@adecore/merge';
import type { Change, TextShape } from '@adecore/merge';
```

## Text shape

| Function                  |                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `splitLines(text)`        | The lines of `text`, split on LF and CRLF. A final newline leaves no empty last line, and `''` gives `[]`. A lone CR stays in the line.                              |
| `shapeOf(text)`           | The `TextShape` of `text`: `{ eol: '\n' \| '\r\n', finalNewline: boolean }`. `eol` is CRLF when the first LF has a CR before it. `''` counts as ending on a newline. |
| `joinLines(lines, shape)` | The lines joined with `shape.eol`, plus one at the end when `shape.finalNewline` is set. `[]` gives `''`.                                                            |

Take the shape before you split, from the version that owns it: `shapeOf(ours)` keeps the file as it is on disk. Mixed LF and CRLF come back as one kind, and the diff does not see a change to line endings only.

```ts
const text = 'first\r\nsecond\r\n';
const shape = shapeOf(text);
// { eol: '\r\n', finalNewline: true }

joinLines([...splitLines(text), 'third'], shape);
// 'first\r\nsecond\r\nthird\r\n'
```

## diffLines

`diffLines(base, other)` returns `Change[]` in reading order. A `Change` is `{ baseStart, baseEnd, otherStart, otherEnd }`, zero-based with exclusive ends. An insert has an empty base range, a delete an empty other range. Every range points into the original arrays, so applying the changes needs no shifting:

```ts
const base = ['first', 'old', 'last'];
const other = ['first', 'new', 'extra', 'last'];

const rebuilt: string[] = [];
let cursor = 0;

for (const change of diffLines(base, other)) {
    rebuilt.push(...base.slice(cursor, change.baseStart), ...other.slice(change.otherStart, change.otherEnd));
    cursor = change.baseEnd;
}

rebuilt.push(...base.slice(cursor));
```

Here `diffLines` returns one change, `{ baseStart: 1, baseEnd: 2, otherStart: 1, otherEnd: 3 }`. Adjacent edits come back as one change.

To show a diff as a patch with context lines, use [`patchOf`](/merge/patches#computed-patches) instead.

## Limits

Past 4000 edits, `diffLines` returns the whole changed middle as one change. The result still rebuilds `other`, but a three-way merge then shows that middle as one large conflict. The limit is fixed, and the call has no cancellation.
