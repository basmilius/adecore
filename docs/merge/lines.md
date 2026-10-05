# Lines and diffs

Every function in the package works on arrays of lines. A line holds no line ending; the endings and whether the file ends on one are kept apart in a `TextShape`, and put back when the lines are joined.

```ts
import { diffLines, joinLines, shapeOf, splitLines } from '@adecore/merge';
import type { Change, TextShape } from '@adecore/merge';
```

## Text shape

| Function | |
| --- | --- |
| `splitLines(text)` | The lines of `text`, split on LF and CRLF. A final newline leaves no empty last line, and `''` gives `[]`. A lone CR stays in the line. |
| `shapeOf(text)` | The `TextShape` of `text`: `{ eol: '\n' \| '\r\n', finalNewline: boolean }`. `eol` is CRLF when the first LF has a CR before it. `''` counts as ending on a newline. |
| `joinLines(lines, shape)` | The lines joined with `shape.eol`, plus one at the end when `shape.finalNewline` is set. `[]` gives `''`. |

Take the shape before you split, and pick which version owns it: `shapeOf(ours)` keeps the file as it is on disk. A file that mixes LF and CRLF comes back with one kind only, and a change that only touches line endings is invisible to the diff. An app that has to keep mixed endings or the original encoding needs its own representation around these functions.

## diffLines

`diffLines(base, other)` returns where `other` differs from `base`, as `Change[]` in reading order. A `Change` is `{ baseStart, baseEnd, otherStart, otherEnd }`: the lines it replaces in `base` and the lines that replace them in `other`, counted from zero, `end` exclusive. An insert has an empty base range, a delete an empty other range.

Every range points into the original arrays, so applying the changes needs no shifting:

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

Here `diffLines` returns one change, `{ baseStart: 1, baseEnd: 2, otherStart: 1, otherEnd: 3 }`. Edits that follow each other with no equal line between them come back as one change.

## Limits

The diff strips the lines both versions start and end with, then runs Myers' algorithm on the middle, which finds the shortest list of inserts and deletes. It gives up when that list would pass 4000 edits and answers the whole middle as one change instead. The result still rebuilds `other` exactly, but a three-way merge then shows the middle as one large conflict. The limit counts edits, not lines, and it cannot be configured.

The walk keeps one state in 64 and walks the rounds between them again on the way back, so its memory stays bounded at that limit. It has no cancellation and no progress; the call returns when it is done.
