# Reviews and agents

The editor draws what an agent proposed or wrote; these parts give that a React face. Asking the agent, keeping its proposals and deciding who may accept them stay with the app.

## ChangeReview

<Demo src="editor/change-review" />

`ChangeReview` draws a proposed change to a stretch of the file as a diff in the editor's own font and colors: unchanged lines, removed lines faded with `-`, added lines with `+`, and the replaced words in a stronger tint. It is meant for an [editor row](#rows-and-actions-in-react) under the stretch.

| Prop        | Type        | Meaning                                                                 |
| ----------- | ----------- | ----------------------------------------------------------------------- |
| `editor`    | `Editor`    | The editor whose `renderCode` draws the lines                           |
| `selected`  | `string`    | The text as it stands                                                   |
| `proposal`  | `string`    | The text as proposed                                                    |
| `startLine` | `number`    | The one-based number of the first line; `1` by default                  |
| `label`     | `string`    | The accessible name of the review                                       |
| `actions`   | `ReactNode` | Drawn under the diff, such as Accept and Reject                         |
| `className` | `string`    | On the outer `section`                                                  |

The component accepts nothing itself. To accept, guard the stretch with a [tracked range](/editor/editing#tracked-ranges) while the proposal is out, and apply the proposal over it:

```ts
const current = tracked.get();

if (current !== null && editor.textInRange(current) === selected) {
    editor.applyEdits([{ range: current, text: fitReplacement(selected, proposal) }]);
}
```

`fitReplacement` gives the proposal the line breaks and the trailing break of the selected text. `parseAnswer` takes the last closed `replacement` fence out of a model's Markdown answer, with the rest as explanation. See [proposals](/editor-react/models#proposals-and-diffs).

## AttributionCard

<Demo src="editor/attribution-card" />

`AttributionCard` is a card about a run of lines an agent wrote, placed by the `rect` that [`onAttributionHover`](/editor/agents#attribution-marks) reports.

| Prop                  | Meaning                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `rect`                | Where the bar is, in page pixels                                   |
| `title`, `subtitle`   | Such as the agent's name and what it did                           |
| `metadata`            | A line of the app's own under the title                            |
| `prompt`              | What the agent was asked, quoted                                   |
| `color`, `icon`       | The agent's color and an icon; a dot in that color by default      |
| `actions`             | Buttons under the card                                             |
| `onHold(inside)`      | The pointer entered or left the card, to keep it open meanwhile    |

## Rows and actions in React

The editor makes a widget row's element again whenever the row scrolls back into view. `RowHost` keeps track of those elements so React can portal into them:

```tsx
const rows = new RowHost(editor, 'review');
rows.set([{ id: 'proposal', line: 7, placement: 'below', height: 120 }]);

// In the component:
useSyncExternalStore(rows.subscribe, rows.getVersion);
const container = rows.container('proposal');

return container === undefined ? null : createPortal(<ChangeReview editor={editor} {...review} />, container);
```

`set(rows)` replaces the owner's rows; the same ids, lines and placements again change nothing, so a new `height` alone does not reach the editor. `clear()` removes them. Since the element comes and goes, keep state outside it.

`LineActionHost(editor, owner)` does the same for [line actions](/editor/rows#line-actions): `set` takes `{ id, line }`s, and an element lives as long as its action, so React state in it survives.

The editor has one set of line highlights, and a review and a conflict may both want some. `highlightLayers(editor)` returns the `HighlightLayers` of an editor: `set(owner, provider)` takes a function that returns the owner's highlights as they stand now, and `set(owner, null)` removes them. Every change reads all owners again, so one owner never brings back the old lines of another.
