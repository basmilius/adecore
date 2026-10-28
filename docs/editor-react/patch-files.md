# Patch files

An editable `.patch` or `.diff` file can look like the [diff views](/editor-react/change-review), with its files listed in a tree. `patchLayoutOf` reads the text and `decoratePatch` applies the result to a mounted editor. The editor stays editable; saving is up to the host.

## Reading a patch

`patchLayoutOf(text, limits?)` from `@adecore/editor-react/models` never throws and returns a `PatchLayout`:

- `lines` has one entry per line of `text.split('\n')`, with a `role` and, for hunk lines, the one-based `old` and `new` numbers (`null` where absent).
- `files` lists the file sections: `oldPath` and `newPath` (`null` for `/dev/null`), `status`, the zero-based `firstLine` and `lastLine`, the `added` and `removed` counts and the `hunks`.
- `truncated` says the text went past a limit.
- Paths lose `a/` and `b/` only when the `diff --git` line shows both prefixes.

| Role                          | Lines                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `file-header`                 | `diff --git`, `---`, `+++`, `index`, the mode, similarity, rename and copy lines          |
| `hunk-header`                 | `@@ -a,b +c,d @@ section`                                                                 |
| `context`, `added`, `removed` | The lines of a hunk. An empty line inside a hunk is context whose space an editor trimmed |
| `no-newline`                  | `\ No newline at end of file`                                                             |
| `binary`                      | `Binary files a and b differ`, and the data of a `GIT binary patch`                       |
| `other`                       | Everything else: a mail header, a diffstat, a blank line, a line that belongs nowhere     |

A file `status` is `added`, `deleted`, `renamed`, `copied`, `modified` or `binary`. Git patches and plain `diff -u` output both work, including quoted paths, names with spaces and CRLF line endings.

### An edited patch

Editing a patch breaks its counts, and the reading copes. A hunk whose lines no longer match its header gets `consistent: false`. A line typed below a complete hunk extends it. Line numbers follow the header and the lines above and are not repaired.

### Limits

`limits` has `maxLines` (50,000) and `maxCharacters` (4,000,000). Past either, `lines` ends, `truncated` is `true`, and the rest has no role.

```ts
import { patchLayoutOf } from '@adecore/editor-react/models';

const layout = patchLayoutOf(text);
for (const file of layout.files) {
    console.log(file.status, file.newPath, `+${file.added} -${file.removed}`);
}
```

## Drawing it

`decoratePatch(editor, options?)` styles a mounted editor that holds the patch text:

- Added and removed lines get the bars, tints and numbers of the [diff views](/editor-react/change-review#gutter).
- The gutter shows hunk numbers instead of file line numbers, and none on headers. `numbers: 'single'` shows the old number on removed lines and the new one otherwise; `'both'` shows both.
- File headers sit on a raised surface; hunk headers are tinted in the accent color.
- With `labels`, a screen reader hears `Removed, old line 8`, `Added, new line 12` or `Old line 3, new line 3`. The hook below fills them.

`onLayout` gets the layout after the first read, after `refresh()`, and once edits rest for `delay` ms (150), so a file tree is not rebuilt per keystroke. The call returns a `PatchDecoration` with the current `layout`, `refresh()` and `dispose()`. `dispose()` removes only its own decorations. Patches under `immediateBelow` characters (100,000) redecorate within a frame of an edit; larger ones after `delay`. `timer` replaces `setTimeout` and `clearTimeout` in tests.

```ts
import { decoratePatch } from '@adecore/editor-react';

const decoration = decoratePatch(editor, {
    numbers: 'both',
    limits: { maxLines: 20_000 },
    onLayout: (layout) => tree.setFiles(layout.files)
});
```

In React, `usePatchDecorations(editor, options?)` does the same for the editor's lifetime, with labels from the `editor` namespace. It returns the layout, or `null` without an editor.

The decorations use the editor's line highlights, line number provider and line labels, so a host that sets those on the same editor replaces them.
