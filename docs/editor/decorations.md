# Decorations

Language server and version control data reach the editor as decorations. Each setter replaces what it set before. Most decorations follow their text through edits until set again.

<Demo src="editor/decorations" />

## Problems

`setMarkers(markers)` draws a squiggle under each `EditorMarker` range and a tick in the scroll track, colored by `severity`, an `EditorMarkerSeverity` of `error`, `warning`, `info` or `hint`. `unnecessary: true` fades the text and `deprecated: true` strikes it through. The tick shows `message` on hover and jumps to the problem on press.

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

- `setHighlights(highlights)` marks the other uses of the name at the caret. Each `EditorHighlight` has a `range` and a `kind`, an `EditorHighlightKind` of `text`, `read` or `write`. The next edit clears them.
- `setLink(range)` underlines a range as a link, such as a name while Mod is held, until the next `setLink` or edit. `null` removes it.
- `setInlayHints(hints, owner?)` draws each `label` as a pill between two characters, such as a parameter name or a type. It is not part of the text. Each owner's hints are replaced separately (`default` without one). A hint may also carry:
    - `parts`, the label split into strings, each its own element for pointer targeting.
    - `paddingLeft` and `paddingRight`, a 4-pixel gap beside the pill. A press in the gap counts as a press beside the hint.
    - `id`, which names the hint in events (`hint-<index>` by default).
    - `swatch`, a CSS color drawn as a 12-pixel square instead of the label, such as the color a literal stands for. The label then names the square.
- `onInlayHover(listener)` reports the hint and label part under the pointer as an `EditorInlayTarget` with its `rect` in page pixels, or `null`.
- `onInlayClick(handler)`, with an `EditorInlayClickHandler`, sees a primary-button press on a hint first, as an `EditorInlayClick`: `id`, `part`, `mod`, `alt`, `shift`, `clicks` (2 for a second press within half a second) and `touch`. A handler returning `true` takes the press, and caret and focus stay put. Otherwise the caret goes to the hint's nearest edge, never inside it.
- `setInlayLink(target)` underlines a hint or one of its parts with a pointing hand, until another target, `null` or new hints.

The three inlay methods are optional on `Editor`. Hints are pointer-only and hidden from assistive technology, so the host must offer a keyboard route to the same action.

## Semantic colors

`setSemanticTokens(tokens)` colors ranges from a language server over the grammar's colors. Each `EditorSemanticToken` has a `line`, `character`, `length` and the TextMate `scopes` it stands for; the theme picks the color. A token with `within: 'string'` (or `comment`, `regex`) colors only text the grammar classed that way, such as SQL inside a string. This needs `scopeColors` on the engine, usually `shikiScopeColors`. `null` removes the tokens. See [Theme and syntax](/editor/theme#semantic-colors).

## Change marks

`setChangeMarks(marks, layer?)` shows how the text differs from a base version, in the gutter and scroll track. An `EditorChangeMark` has a `kind`, an `EditorChangeKind` of `added`, `modified` or `deleted`, and one-based inclusive `startLine` and `endLine`. A `deleted` mark sits on the line after the removed text, with both lines equal. Each layer holds its own marks and the editor draws their union, so Git marks and a patch decoration never overwrite each other. An empty list removes the layer. Where layers overlap, the layer that most recently became non-empty wins.

The optional `onChangeMarkHover(listener)` reports an `EditorChangeMarkHover`: `mark` is the owning mark's current one-based range and kind, `layer` identifies its owner, `line` is the boundary or row under the pointer, and `rect` is in screen pixels. Adjacent painted bars keep their separate identities. The same layer and removal precedence serves painting and hovering. The event includes changes behind attribution bars, but not behind a line-highlight bar. Deleted marks are hit around the boundary between rows. Geometry follows scrolling and canvas scale; removing a mark reports `null` without another pointer move. Touch pointers do not trigger this subscription.

The host owns what to show or edit. Subscribe only while the file is mounted, dispose the subscription with it, and guard the method on an older editor implementation. An empty hover is `null`.

## Gutter buttons

- `setGutterAction(action)` puts one button in the gutter, an `EditorGutterAction` of `{ line, label }`, such as a code action lightbulb. `onGutterAction` reports a press with the zero-based line. `null` removes it.
- `setGutterMarkers(markers, owner?)` puts small buttons on lines, each an `EditorGutterMarker` of `{ id, line, label, icon?, pressed? }`. `icon` is an `EditorGutterIcon`, `sparkles` (default) or `book-open`. `pressed` draws a toggle as on and sets `aria-pressed`. Each owner has its own set (`default` without one). `onGutterMarker` reports a press with the id.

## Lines, from one or from zero

Whole-line decorations take one-based inclusive lines: change marks, [attribution marks](/editor/agents) and [line highlights](/editor/rows#line-highlights). Single-line placements take a zero-based `line`: widgets, line actions, code vision, gutter actions and gutter markers. Markers, highlights, links, inlay hints and remote cursors take `EditorPosition`s.
