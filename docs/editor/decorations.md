# Decorations

Language server and version control data reach the editor as decorations. Each setter replaces what it set before. Most decorations follow their text through edits until set again.

<Demo src="editor/decorations" />

## Problems

`setMarkers(markers)` draws a squiggle under each range and a tick in the scroll track, colored by `severity` (`error`, `warning`, `info` or `hint`). `unnecessary: true` fades the text and `deprecated: true` strikes it through. The tick shows `message` on hover and jumps to the problem on press.

```ts
editor.setMarkers([
    {
        range: { start: { line: 3, character: 34 }, end: { line: 3, character: 43 } },
        severity: 'error',
        message: "Cannot find name 'OrderLine'."
    }
]);
```

The editor draws no message card of its own. [`@adecore/editor-react`](/editor-react/hover) shows one on hover.

## Names and hints

- `setHighlights(highlights)` marks the other uses of the name at the caret, each with a `kind` of `text`, `read` or `write`. The next edit clears them.
- `setLink(range)` underlines a range as a link, such as a name while Mod is held, until the next `setLink` or edit. `null` removes it.
- `setInlayHints(hints, owner?)` draws each `label` as a pill between two characters, such as a parameter name or a type. It is not part of the text. Each owner's hints are replaced separately (`default` without one). A hint may also carry:
    - `parts`, the label split into strings, each its own element for pointer targeting.
    - `paddingLeft` and `paddingRight`, a 4-pixel gap beside the pill. A press in the gap counts as a press beside the hint.
    - `id`, which names the hint in events (`hint-<index>` by default).
    - `swatch`, a CSS color drawn as a 12-pixel square instead of the label, such as the color a literal stands for. The label then names the square.
- `onInlayHover(listener)` reports the hint and label part under the pointer as an `EditorInlayTarget` with its `rect` in page pixels, or `null`.
- `onInlayClick(handler)` sees a primary-button press on a hint first, as an `EditorInlayClick`: `id`, `part`, `mod`, `alt`, `shift`, `clicks` (2 for a second press within half a second) and `touch`. A handler returning `true` takes the press, and caret and focus stay put. Otherwise the caret goes to the hint's nearest edge, never inside it.
- `setInlayLink(target)` underlines a hint or one of its parts with a pointing hand, until another target, `null` or new hints.

The three inlay methods are optional on `Editor`. Hints are pointer-only and hidden from assistive technology, so the host must offer a keyboard route to the same action.

## Semantic colors

`setSemanticTokens(tokens)` colors ranges from a language server over the grammar's colors. Each `EditorSemanticToken` has a `line`, `character`, `length` and the TextMate `scopes` it stands for; the theme picks the color. A token with `within: 'string'` (or `comment`, `regex`) colors only text the grammar classed that way, such as SQL inside a string. This needs `scopeColors` on the engine, usually `shikiScopeColors`. `null` removes the tokens. See [Theme and syntax](/editor/theme#semantic-colors).

## Change marks

`setChangeMarks(marks, layer?)` shows how the text differs from a base version, in the gutter and scroll track. An `EditorChangeMark` has a `kind` of `added`, `modified` or `deleted` and one-based inclusive `startLine` and `endLine`. A `deleted` mark sits on the line after the removed text, with both lines equal. Each layer holds its own marks and the editor draws their union, so Git marks and a patch decoration never overwrite each other. An empty list removes the layer. Where layers overlap, the layer that most recently became non-empty wins.

## Gutter buttons

- `setGutterAction(action)` puts one button in the gutter, `{ line, label }`, such as a code action lightbulb. `onGutterAction` reports a press with the zero-based line. `null` removes it.
- `setGutterMarkers(markers, owner?)` puts small buttons on lines, `{ id, line, label, icon?, pressed? }`. `icon` is `sparkles` (default) or `book-open`. `pressed` draws a toggle as on and sets `aria-pressed`. Each owner has its own set (`default` without one). `onGutterMarker` reports a press with the id.

## Lines, from one or from zero

Whole-line decorations take one-based inclusive lines: change marks, [attribution marks](/editor/agents) and [line highlights](/editor/rows#line-highlights). Single-line placements take a zero-based `line`: widgets, line actions, code vision, gutter actions and gutter markers. Markers, highlights, links, inlay hints and remote cursors take `EditorPosition`s.
