# Diffs

The file changes a chat reports, highlighted with Shiki. The thread draws them under a tool call, in a turn's changed files and in an approval; use them in a review pane of your own too. They write nothing. A host that hands `code.editor` gets editor reviews; without it they draw with `@pierre/diffs`.

```tsx
import { UnifiedDiff, EditDiff, DiffPool } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/diffs" />

## UnifiedDiff

A unified patch in a `ChatFileChange`. A patch without a file header gets one from the path; text without hunks shows as plain lines. Its `contents` is a `DiffContents`.

| Prop        | Type                     |                                                                                     |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `change`    | `ChatFileChange`         | `path`, `kind` and `diff`.                                                          |
| `diffStyle` | `'unified' \| 'split'`   | Stacked or side by side. `unified` by default.                                       |
| `overflow`  | `'wrap' \| 'scroll'`     | `wrap` by default.                                                                  |
| `fill`      | `boolean`                | Grow to the height of a flex column around it.                                      |
| `contents`  | `{ old, new }`           | Both whole texts. With them a person can unfold the lines between hunks (`fullFileDiff`). |
| `onSource`  | `(source: DiffSource) => void \| (() => void)` | Per editor of the diff, where its caret stands in the new file ([`DiffView`](/editor-react/change-review)). The Pierre and plain fallbacks never call it. |

`ignoreWhitespace` accepts patches made with whitespace filtering. `allowEditor={false}` keeps the Pierre renderer.

## EditDiff

The text before and after one edit: `change` is a `FileChange`, `{ path, before, after }`. With the host's `code.editor`, it draws in an editor `DiffView` with per-side highlighting and selectable removed lines. Set `allowEditor={false}` to keep Pierre where editor scrolling and keys do not fit the container. A load failure shows the path and "Could not load this diff".

## Limits

Both views take an optional `maxHeight` in pixels; the editor's default is 480, and `fill` ignores it. A change too large to draw shows its path and "Too large to show" without computing hunks. Very large edits fall back to a coarse replacement without word emphasis. A side too large to highlight stays plain, so a split review may color only one side.

## Lazy legacy workers

Set the host's `code.legacyDiffWorker` to a worker factory for `@pierre/diffs/worker`. Only a Pierre diff starts these workers, and they stop when the last one unmounts. An enclosing `DiffPool` takes precedence. The worker package must match the renderer's version.

## DiffPool

Every diff under the pool shares two highlighting workers. Hand it a worker factory from your bundler. With Vite:

```tsx
import DiffWorker from '@pierre/diffs/worker/worker.js?worker';

<DiffPool workerFactory={() => new DiffWorker()}>{chat}</DiffPool>;
```

Without a pool, diffs highlight on the main thread. The pool follows the theme of the host's `code`.

## Changes of a turn

`ChatActions.turnDiff(chatId, turnId)` returns the working tree against the checkpoint the turn started from, or `null`. The timeline reads other changes from the tool calls.

A turn whose diff the host keeps apart (`checkpointDiffRef`) lists every file. A held-back file offers "Show full diff", which loads through `turnDiff`. A truncated tool output (`outputRef`) offers "Show full output", which loads through `ChatActions.toolOutput(chatId, itemId)`. A failed load shows "Try again".

## Reviewing several changes

An approval card shows one change at a time, picked in a file toolbar. Arrow keys, Home and End move between its buttons. Mod+Enter in the editor runs the card's primary action, and Allow applies to the whole request.

A tool row or changed-files card opens a few diffs at once. Others show their path and a Show diff button.
