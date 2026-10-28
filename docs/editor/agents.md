# Agents

Three decorations show what an agent did or is doing in a file. The editor only draws them. The app decides who the agent is, which lines it wrote and when to accept a suggestion.

<Demo src="editor/agents" />

## Colors

`AGENT_COLORS` lists six custom properties, `--agent-1` through `--agent-6`, defined by `editor.css` for both themes, with `--agent-ink` for text on them. Pass the property name as the color so it follows the theme. Any CSS color works too.

## Attribution marks

`setAttributionMarks(marks)` draws a three-pixel gutter bar beside each run of lines an agent wrote. An `EditorAttributionMark` has an `id`, one-based inclusive `startLine` and `endLine`, and a `color`. On a line with a [change mark](/editor/decorations#change-marks), the bar replaces it; the scroll track still shows the change.

`onAttributionHover(listener)` reports the `id` and the bar's `rect` under the pointer, and `null` when it leaves. [`AttributionCard`](/editor-react/change-review#attributioncard) is a card to show there.

The runs follow their text through edits until the app sets them again.

## Remote cursors

`setRemoteCursors(cursors)` draws an agent's caret with a name label: `id`, `position`, `name` and `color`. The label sits above the caret, or below when there is no room. A remote cursor follows its text, ignores the pointer, hides on a folded line and never moves the editor's own caret.

## Ghost text

`setGhostText(ghost)` draws a suggestion after a position, such as a model's continuation of a line. The first line of `text` appears inline, faint and italic, after the caret. Further lines push the lines below down. `accessory(container)` fills an element after the first line, such as a key hint. `null` removes the suggestion, and so does any text change.

The editor never accepts a suggestion. The app binds a key, checks the suggestion still fits and inserts it:

```ts
editor.setGhostText({ position, text: suggestion });

editor.onKeyDown((event) => {
    if (event.key !== 'Tab') {
        return false;
    }
    return editor.applyEdits([{ range: { start: position, end: position }, text: suggestion }]);
});
```

`acceptGhostWord` in the [key table](/editor/options#keymaps) names a key for taking one word. It has no default chord, and the editor does nothing with it.
