# Search, folds, and widgets

## Find and replace

`find(query)` marks results and moves to the first match from the caret; `find(null)` clears marks. `EditorFindQuery` requires `text`, `caseSensitive`, `wholeWord`, and `regex`. `inSelection` captures the selected region when enabled, so moving to results does not change the search scope. `onFind` reports count and zero-based current index, or `noSelection` when the restricted search has no selected text.

```ts
import type { Editor } from '@adecore/editor';

export function replaceNames(editor: Editor): number {
    editor.find({ text: 'item', caseSensitive: false, wholeWord: true, regex: false });
    const count = editor.replaceAll('entry', { preserveCase: true });
    editor.endFind();
    return count;
}
```

`findStep(1 | -1)` steps through results. `replace` edits the current result and advances, returning `false` without a result or in read-only mode. `replaceAll` is one undo step. Regex replacement supports dollar capture patterns. `setReplacePreview` draws the current replacement without changing text; clear it with `null`. `selectFindMatches` ends find and creates a caret/selection at every match. `endFind` leaves the selection at the current result. `findFromCursor` provides result navigation without an open bar.

Validate regex input before calling `find`; the core throws for invalid patterns and has no timeout for expensive ones. The React [`FindReplace`](/editor-react/handbook/lifecycle-testing#find-and-replace) component validates syntax for its own controls.

## Folding

`runCommand` supports collapsing/expanding a region, all regions, recursive regions, a selection, documentation comments, and expansion to levels 1 through 5. It also supports `toggleColumnMode`. `setFoldHints` merges language-server ranges and symbol body kinds with lexical folds. `setBlocks` supplies named scopes for sticky headers and `onScope`; `null` restores lexical scope detection.

`EditorFoldRange` is zero-based. `EditorBlock` uses one-based inclusive lines. `getFolds` returns collapsed ranges and custom selection folds for a future mount's `folds`. The editor does not persist them. `foldDefaults` applies once to an untouched file without restored fold state, including roles discovered later by a server. It avoids the caret/selection and folds a person already decided on; the first edit stops automatic defaults.

A collapsed fold is one row for line commands and bare-caret copy/cut, so those commands include its hidden lines. A line inside a fold has no line action. Folding is a view choice; the hidden text still belongs to the document and language service.

## Decoration lifetimes

| Setter                                                                           | Ownership / lifetime                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `setMarkers`                                                                     | Replaces all problems; mapped through edits until replaced                 |
| `setHighlights` / `setLink`                                                      | Replace current highlights/link; text edits clear them                     |
| `setInlayHints` / `setSemanticTokens`                                            | Replace the current hint/token set; map existing positions until refreshed |
| `setChangeMarks`, `setAttributionMarks`, `setRemoteCursors`, `setLineHighlights` | Replace each set; follow their text through edits                          |
| `setGhostText`                                                                   | One visual suggestion; any text change clears it                           |
| `setWidgets`, `setLineActions`, `setGutterMarkers`                               | Independent named owners; an empty list clears only that owner             |
| `setGutterAction`                                                                | One action, cleared with `null`                                            |
| `setCodeVision`                                                                  | One declaration-row set, separate from widgets                             |

Most line decoration spans (`EditorChangeMark`, `EditorAttributionMark`, `EditorLineHighlight`) use one-based inclusive lines. Widgets, line actions, gutter actions/markers, and code vision use zero-based lines. Markers and remote cursors use `EditorPosition` / `EditorRange`. Use the public types at each boundary.

## Host-owned rows

```ts
import type { Editor } from '@adecore/editor';

export function showRemovedCode(editor: Editor): () => void {
    editor.setWidgets(
        [
            {
                id: 'removed-1',
                line: 0,
                placement: 'above',
                height: 24,
                render(container) {
                    editor.renderCode(container, 'const oldValue = 1;', {
                        sign: '-',
                        color: '--editor-deleted',
                        faded: true
                    });
                }
            }
        ],
        'review'
    );
    return () => editor.setWidgets([], 'review');
}
```

A widget's container is recreated when its row returns to view. Its `render` must refill it and must not keep durable state inside that DOM element. Owners at the same line sort by owner name, then input order. Line-action containers live as long as their actions, render once, take no row height, and can fall outside the viewport after a long unwrapped line.

`renderCode` draws text that is not part of the document, in its font and syntax colors. `EditorCodeBlockOptions` supports line numbers, sign, tint, per-line UTF-16 emphasis ranges, and faded text. Host React portals can use [`RowHost` / `LineActionHost`](/editor-react/handbook/review-proposals).

`setGhostText` only draws. The host must bind acceptance, validate the current text, and apply an edit. `onAttributionHover` reports a mark id and screen rectangle; the host provides the author card. `onGutterMarker` and `onGutterAction` report activation without applying a change.
