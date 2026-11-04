# Patches

A unified patch is the text `git diff` writes. The package parses one, checks it against the two versions it claims to describe, and computes one from two texts.

```ts
import { missingSides, parseHunkHeader, parsePatch, patchFits, patchOf } from '@adecore/merge';
import type { Hunk, HunkHeader, ParsedPatch, PatchLine } from '@adecore/merge';
```

## Parsing a patch

`parseHunkHeader(line)` reads one `@@ -a,b +c,d @@ section` line into a `HunkHeader` (one-based starts, a count of one when omitted), or returns `undefined`.

`parsePatch(patch)` reads one file's unified patch into a `ParsedPatch`, with or without file headers. Each `Hunk` has zero-based `oldStart` and `newStart`, counts, section text and `PatchLine` entries (`context`, `delete` or `insert`). Carriage returns stay in the text. The line before a `\ No newline at end of file` marker gets `noNewline: true`.

```ts
const parsed = parsePatch('@@ -1 +1 @@\n-old\n+new\n');
// parsed.hunks[0].lines: [{ kind: 'delete', text: 'old' }, { kind: 'insert', text: 'new' }]
```

`parsePatch` never throws. A truncated or malformed hunk, overlapping hunks or a multi-file patch set `partial: true`, and the recognized lines stay. It does not support combined diffs, binary patches, rename metadata or quoted paths.

## Patch snapshots

`missingSides(patch)` reads a single-file patch header and returns `{ old, new }`. A side is missing when its filename is `/dev/null`, as for a new or a deleted file. Without file headers, neither side is missing.

`patchFits(patch, oldText, newText, ignoreWhitespace)` checks that every displayed line of every hunk occurs at its coordinates in the matching snapshot. It returns `false` without a hunk or on any mismatch. Set `ignoreWhitespace` for a patch made with Git's `--ignore-all-space`.

```ts
const patch = '--- a/code.ts\n+++ b/code.ts\n@@ -1 +1 @@\n-old\n+new\n';
missingSides(patch); // { old: false, new: false }
patchFits(patch, 'old\n', 'new\n', false); // true
```

`patchFits` checks the displayed lines of single-file unified hunks only. It skips hunk counts, newline markers and multi-file syntax, so never use it to authorize applying an untrusted patch.

## Computed patches

`patchOf(oldText, newText, context = 3, options?)` returns a `ParsedPatch` for two complete texts. Hunks whose context touches merge. A repeated blank line at the end of a pure insertion or deletion moves to its start, so an added function includes its leading separator.

```ts
const patch = patchOf('title\nold value\nfooter\n', 'title\nnew value\nfooter\n');
// One hunk: context 'title', delete 'old value', insert 'new value', context 'footer'
```

An unchanged pair yields no hunks. An invalid `context` throws `RangeError`. A hunk whose changed block spans more than 4000 lines has `coarse: true`, so a renderer can skip word pairing. To bound the work on large input, pass `{ maxWork: 2_000_000 }` as the fourth argument. Past the limit, the unmatched middle becomes one `coarse` replacement hunk.

A parsed or computed patch becomes rows for a view through [`diffDocument`](/merge/diff-rows).
