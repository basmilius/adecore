# DiffView

`DiffView` (`DiffViewProps`) is a read-only diff in the editor `engine`, unified or side by side. Pass a `DiffDocument` from [`@adecore/merge`](/merge/diff-rows), a syntax `theme` and an accessible `label`.

```tsx
import { DiffView } from '@adecore/editor-react';
import { diffDocument, patchOf } from '@adecore/merge';

const document = diffDocument(patchOf(before, after), { old: before, new: after });

<DiffView engine={engine} document={document} theme="github-dark" label="Proposed changes" />;
```

| Prop                    | Meaning                                                                                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`                | `'unified'` (default) or `'split'`, two editors with synchronized vertical scrolling                                                                                                                                                    |
| `wrap`                  | Wraps lines; `true` by default                                                                                                                                                                                                          |
| `splitWrapLimit`        | Above this many rows (2,000), split turns wrap off                                                                                                                                                                                      |
| `fill`                  | The parent sets the height; otherwise the view grows to its content                                                                                                                                                                     |
| `maxHeight`             | Caps that growth in pixels; taller diffs scroll inside. Ignored with `fill`                                                                                                                                                             |
| `numbered`              | `false` draws no line numbers, for a fragment whose place in its file is not known; `true` by default                                                                                                                                   |
| `unfoldLimits`          | A `DiffLimits` (`rows`, `characters`, `lineLength`) for context expansion; 20,000 rows, 2,000,000 UTF-16 units, 10,000 per line                                                                                                         |
| `tokens`                | [Source tokens](#source-tokens)                                                                                                                                                                                                         |
| `onMount(editor, side)` | Runs per editor, to attach a find bar or commands; may return a cleanup. `side` is `old` or `new` in split, absent in unified                                                                                                           |
| `onSource(source)`      | Runs per editor with a `DiffSource`: its `editor`, its `side` and `at()`, the line and column of the new file under the caret (`sourceLineOf`), or null where the new file has none. A host uses it to open the file there, on the `jumpToSource` key |

`className` and `ref` belong to the outer element.

Removed and added lines are document text, so selection, copy, find and wrapping work as in the editor. Line numbers stay out of copied text, and copy joins lines with LF. Hidden context unfolds on click, within `unfoldLimits`; a gap that cannot unfold within them is disabled. A partial patch cannot unfold omitted text. In split, each side holds only its own text, and filler rows take no part in it. A side that is wholly absent falls back to unified.

The view keeps its editor when the document, tokens, theme or wrap change. Folding, sticky blocks and indentation guides are off. Replaced words get a stronger tint; large changes keep only line tints. Mod+Enter passes to the container, so a prompt card's primary action still works.

`DiffView` throws asynchronous alignment failures during render, so an error boundary can replace it. `unfoldLimits` does not bound the initial changes; the caller does.

## Gutter

A changed line has a gutter tinted in its change color, with its number in a readable shade of that color and a bar along the left edge: solid for added, striped for removed. There is no `+` or `-` sign. The colors come from `--editor-added` and `--editor-deleted`; [`--editor-mark-number-mix` and `--editor-mark-bar-width`](/editor/theme) tune the number shade and bar width.

## Accessibility

Color is not the only signal. Each gutter holds hidden text a screen reader reads with the line: `Added, new line 12`, `Removed, old line 8`, or in unified `Old line 3, new line 3`. Split wraps the view in a group named by `label` and each side in a group named `Before` or `After`. The view uses no table roles.

No screen reader has tested this; only LinkeDOM tests check the text and roles.

## Source tokens

`tokens` implements `DiffSourceTokens`. `get(side, index)` returns the `LineToken` array of a zero-based source line, `undefined` while pending, or `null` for plain text. `DiffSourceSide` is `old` or `new`. `subscribe(listener)` reports changes and returns an unsubscribe function. Return the same array while a line is unchanged.

`diffSyntaxDocument(document, language, theme)` returns `DiffSyntaxSources`. `documents.old` and `documents.new` are worker `DiffSyntaxDocument` definitions, and `locate(side, index)` returns a line's `{ block, line }`. The host opens a session per side, requests the block and decodes the line with [`lineTokensOf`](/editor/theme#diff-syntax-in-a-worker). An oversized side gets no blocks and renders plain.
