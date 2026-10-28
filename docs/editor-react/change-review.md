# Reviews and agents

These parts draw what an agent proposed or wrote. Asking the agent, keeping its proposals and deciding who may accept them stay with the app.

## DiffView

`DiffView` (`DiffViewProps`) is a read-only diff in the editor `engine`. Pass a `DiffDocument` from [`@adecore/merge`](/merge/lines), a syntax `theme` and an accessible `label`.

| Prop             | Meaning                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `layout`         | `'unified'` (default) or `'split'`, two editors with synchronized vertical scrolling         |
| `wrap`           | Wraps lines; `true` by default                                                                |
| `splitWrapLimit` | Above this many rows (2,000), split turns wrap off                                            |
| `fill`           | The parent sets the height; otherwise the view grows to its content                           |
| `maxHeight`      | Caps that growth in pixels; taller diffs scroll inside. Ignored with `fill`                   |
| `unfoldLimits`   | A `DiffLimits` (`rows`, `characters`, `lineLength`) for context expansion; 20,000 rows, 2,000,000 UTF-16 units, 10,000 per line |
| `tokens`         | [Source tokens](#source-tokens)                                                               |
| `onMount(editor, side)` | Runs per editor, to attach a find bar or commands; may return a cleanup. `side` is `old` or `new` in split, absent in unified |

`className` and `ref` belong to the outer element.

```tsx
import { DiffView } from '@adecore/editor-react';
import { diffDocument, patchOf } from '@adecore/merge';

const document = diffDocument(patchOf(before, after), { old: before, new: after });
<DiffView engine={engine} document={document} theme="github-dark" label="Proposed changes" />;
```

Removed and added lines are document text, so selection, copy, find and wrapping work as in the editor. Line numbers stay out of copied text, and copy joins lines with LF. Hidden context unfolds on click, within `unfoldLimits`; a gap that cannot unfold within them is disabled. A partial patch cannot unfold omitted text. In split, each side holds only its own text, and filler rows take no part in it. A side that is wholly absent falls back to unified.

The view keeps its editor when the document, tokens, theme or wrap change. Folding, sticky blocks and indentation guides are off. Replaced words get a stronger tint; large changes keep only line tints. Mod+Enter passes to the container, so a prompt card's primary action still works.

### Gutter

A changed line has a gutter tinted in its change color, with its number in a readable shade of that color and a bar along the left edge: solid for added, striped for removed. There is no `+` or `-` sign. The colors come from `--editor-added` and `--editor-deleted`; [`--editor-mark-number-mix` and `--editor-mark-bar-width`](/editor/theme) tune the number shade and bar width.

### Accessibility

Color is not the only signal. Each gutter holds hidden text a screen reader reads with the line: `Added, new line 12`, `Removed, old line 8`, or in unified `Old line 3, new line 3`. Split wraps the view in a group named by `label` and each side in a group named `Before` or `After`. No table roles are used.

No screen reader has tested this; only LinkeDOM tests check the text and roles.

### Source tokens

`tokens` implements `DiffSourceTokens`. `get(side, index)` returns the `LineToken` array of a zero-based source line, `undefined` while pending, or `null` for plain text. `DiffSourceSide` is `old` or `new`. `subscribe(listener)` reports changes and returns an unsubscribe function. Return the same array while a line is unchanged.

`diffSyntaxDocument(document, language, theme)` returns `DiffSyntaxSources`. `documents.old` and `documents.new` are worker `DiffSyntaxDocument` definitions, and `locate(side, index)` returns a line's `{ block, line }`. The host opens a session per side, requests the block and decodes the line with [`lineTokensOf`](/editor/theme#diff-syntax-in-a-worker). An oversized side gets no blocks and renders plain.

## ChangeReview

<Demo src="editor/change-review" />

`ChangeReview` draws a proposed change to a stretch of the file in the editor's font and colors: removed lines faded with `-`, added lines with `+`, replaced words in a stronger tint. It belongs in an [editor row](#rows-and-actions-in-react) under the stretch.

| Prop        | Type        | Meaning                                                |
| ----------- | ----------- | ------------------------------------------------------ |
| `editor`    | `Editor`    | The editor whose `renderCode` draws the lines          |
| `selected`  | `string`    | The text as it stands                                  |
| `proposal`  | `string`    | The text as proposed                                   |
| `startLine` | `number`    | The one-based number of the first line; `1` by default |
| `label`     | `string`    | The accessible name of the review                      |
| `actions`   | `ReactNode` | Drawn under the diff, such as Accept and Reject        |
| `className` | `string`    | On the outer `section`                                 |

The component accepts nothing itself. Guard the stretch with a [tracked range](/editor/editing#tracked-ranges) and apply the proposal over it:

```ts
const current = tracked.get();

if (current !== null && editor.textInRange(current) === selected) {
    editor.applyEdits([{ range: current, text: fitReplacement(selected, proposal) }]);
}
```

`fitReplacement` and `parseAnswer` are described under [proposals](/editor-react/models#proposals-and-diffs).

## AttributionCard

<Demo src="editor/attribution-card" />

`AttributionCard` describes a run of lines an agent wrote, placed at the `rect` that [`onAttributionHover`](/editor/agents#attribution-marks) reports.

| Prop                | Meaning                                                         |
| ------------------- | --------------------------------------------------------------- |
| `rect`              | Where the bar is, in page pixels                                |
| `title`, `subtitle` | Such as the agent's name and what it did                        |
| `metadata`          | A line of the app's own under the title                         |
| `prompt`            | What the agent was asked, quoted                                |
| `color`, `icon`     | The agent's color and an icon; a dot in that color by default   |
| `actions`           | Buttons under the card                                          |
| `onHold(inside)`    | The pointer entered or left the card, to keep it open meanwhile |

## Rows and actions in React

The editor recreates a widget row's element whenever the row scrolls back into view. `RowHost` tracks those elements so React can portal into them:

```tsx
const rows = new RowHost(editor, 'review');
rows.set([{ id: 'proposal', line: 7, placement: 'below', height: 120 }]);

// In the component:
const containers = useSyncExternalStore(
    (listener) => rows.subscribe(listener),
    () => rows.getContainers()
);
const container = containers.get('proposal');

return container === undefined ? null : createPortal(<ChangeReview editor={editor} {...review} />, container);
```

`getContainers` returns the same map until an element comes or goes, so a compiled component redraws exactly then. Call `subscribe` and `getContainers` on the host; they are methods, not free functions. `container(id)` and `getVersion` read the live state outside a render.

`set(rows)` replaces the owner's rows, and `clear()` removes them. A `HostedRow` with `fixed` has an exact height; one with `filler` draws a hatched spacer without a portal. Keep state outside the element, since it comes and goes.

`LineActionHost(editor, owner)` does the same for [line actions](/editor/rows#line-actions). `set` takes `{ id, line }`s, and an element lives as long as its action, so React state in it survives.

The editor has one set of line highlights, which a review and a conflict may share. `highlightLayers(editor)` returns its `HighlightLayers`. `set(owner, provider)` takes a function returning that owner's current highlights, and `set(owner, null)` removes them.

`DiffView` throws asynchronous alignment failures during render, so an error boundary can replace it. The initial changes are not bounded by `unfoldLimits`; the caller bounds them.
