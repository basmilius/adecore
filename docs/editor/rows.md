# Rows and widgets

A host puts its own DOM into the editor as widgets (rows between lines), line replacements, line actions (after a line's last character) and code vision (a row above a declaration). None of them is part of the document.

<Demo src="editor/rows" />

## Widgets

`setWidgets(widgets, owner?)` replaces one owner's rows and leaves the others, so a peek, a review and a conflict can coexist. Without an owner the rows belong to `default`. An empty list removes the owner's rows.

An `EditorWidget` has an `id`, the zero-based `line` it stands next to, a `placement` of `below` (default) or `above`, an estimated `height` until measured, and `render(container)`. With `fixed: true` the `height` is exact and never measured, which keeps spacer rows identical across linked views. Rows on the same line sort by owner name, then by the owner's order.

```ts
editor.setWidgets(
    [
        {
            id: 'removed',
            line: 4,
            placement: 'above',
            render: (container) => editor.renderCode(container, '    var total = 0;', { firstLine: 5, sign: '-', color: '--editor-deleted', faded: true })
        }
    ],
    'review'
);
```

The editor recreates the container and calls `render` again whenever the row scrolls back into view, so keep state outside it. To render React into rows, use [`RowHost`](/editor-react/change-review#rows-and-actions-in-react).

## Replacing lines

`setReplacements(replacements, owner?)` draws document lines as a row of host DOM, such as a documentation comment as formatted text. An `EditorReplacement` has an `id`, zero-based inclusive `startLine` and `endLine`, an estimated `height`, an optional `label` for assistive technology and `render(container)`. The row sizes to its content at the first line's indentation. Vertical caret moves step over it unless `enterable` is true. `onReveal()` runs before the editor scrolls to a target inside the lines, such as a find match, so the host can show them as text first.

The lines stay in the document, so text, history and language servers are unaffected. The row follows its lines through edits. Where two owners claim the same first line, the one that sorts first wins. A row has no caret. A host that wants the lines editable removes the replacement when the caret comes near, as [rendered documentation](/editor-react/rendered-documentation) does. A collapsed fold on the first line draws its placeholder instead. The container has `role="group"` and the `label`. Presses and selection in the row never reach the editor's text.

## Code that is not in the document

`renderCode(container, text, options?)` fills an element with lines in the editor's font and colors, behind a gutter as wide as the editor's, for a widget's `render`: lines an agent removed, or the other side of a conflict.

| `EditorCodeBlockOptions` | Meaning                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `tokens`                 | Tokens per line from the original document, which keep its syntax state, such as inside a multiline comment. `null` draws plain text; omitted, the block is tokenized on its own |
| `firstLine`              | The one-based number of the first line; without it there are no numbers                                                |
| `sign`                   | A character in the gutter of each line, such as `-`                                                                    |
| `color`                  | Tints the rows and draws a bar beside them                                                                             |
| `emphasis`               | Per line, `[from, to]` character ranges in a stronger tint, such as changed words                                      |
| `faded`                  | Draws the text faded, as lines that are gone                                                                           |

## Line highlights

`setLineHighlights(highlights)` tints lines behind the text. Each has one-based inclusive `startLine` and `endLine`, a `color`, and optionally a gutter `sign`, a `bar`, a `fill` and `emphasis`:

- `fill` paints the rows in `color` as is, instead of a light tint.
- `bar: 'solid' | 'hatched'` draws a review gutter: the cell tinted, the number in a readable shade and a solid or striped bar along the left edge across consecutive lines. A line with a bar shows no change mark.
- `emphasis` lists UTF-16 `[from, to]` ranges per line, from `startLine`, in a stronger tint.

Widget rows between tinted lines stay clear. Highlights and emphasis follow their text through edits.

A color here, in `renderCode` and in the [agent marks](/editor/agents) is a custom property name such as `--editor-added` or `--agent-1`, or any CSS color.

## Displayed lines from other documents

`setLineNumbers(labels)` supplies a string or `null` per zero-based line. A `null` label hides that number, and a `null` provider restores normal numbering. The gutter and sticky headers use the labels, and the gutter fits the longest. Labels are read again after each edit or call.

`setLineTokens(provider)` supplies prepared `LineToken` arrays per line, for a document assembled from lines of different files. Grammar tokenization pauses while a provider is set. A `null` or `undefined` result draws plain text. Return the same array for an unchanged line, so scrolling reuses painted spans. Call the setter again when results change; `null` restores grammar coloring. Keep the provider in step with the text.

## Line actions

`setLineActions(actions, owner?)` puts DOM after the last character of a line, such as review buttons. An `EditorLineAction` has an `id`, a zero-based `line` and `render(container)`, which runs once. An action takes no height, follows its line, hides on a folded line and never moves the caret on press. Without wrap it can sit past the right edge.

## Code vision

`setCodeVision(rows)` puts a row above each declaration, such as the usage count and author. An `EditorCodeVision` has an `id`, the declaration's zero-based `line` and `entries`. Each `EditorCodeVisionEntry` has an `id`, `text`, an optional `icon` of `user` or `users`, and `activate(anchor)`, which gets the entry's box in page pixels.

The row is one line high at the declaration's indentation, and keeps its height while empty so text does not jump. Code vision rows are separate from widgets. [`@adecore/editor-react`](/editor-react/code-vision) fills them from a language server and Git blame.

## Content height

`getContentHeight()` returns the pixel height that shows every row without vertical scrolling, wrapped lines, widgets, padding and scrollbar included. Read it after mounting and on `onViewChange` to size a host that grows with its content.

`getLineHeight(line)` returns a zero-based line's text height without widgets. Wrapped lines out of view use an estimate until drawn. Hidden or missing lines return zero. `getBaseLineHeight()` is the height of one plain line; it is optional, so check `editor.getBaseLineHeight?.()`. `onLineHeights(listener)` reports line height changes after rendering, so the listener can adjust widgets. Widget height changes alone do not fire it. `setScrollTop(top)` syncs viewports at once: it cancels an animated scroll and repaints before returning.

Very long wrapped lines draw only the rows near the viewport, but selection, copy and hit testing still see the whole line. Editing a long line still measures all of it.
