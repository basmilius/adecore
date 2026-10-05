# Agents

Three decorations show what an agent did or is doing in a file. The editor only draws them: who the agent is, which lines it wrote and when a suggestion is accepted are the app's to decide.

<Demo src="editor/agents" />

## Colors

`AGENT_COLORS` lists six custom properties, `--agent-1` through `--agent-6`, defined by `editor.css` for both themes, with `--agent-ink` for text on them. Pass the property name as the color so it follows the theme. Any CSS color works too.

## Attribution marks

`setAttributionMarks(marks)` draws a three-pixel bar in the gutter beside each run of lines an agent wrote. An `EditorAttributionMark` has an `id`, one-based, inclusive `startLine` and `endLine`, and a `color`. On a line that also has a [change mark](/editor/decorations#change-marks), the bar takes the change mark's place there; the scroll track still shows it.

`onAttributionHover(listener)` reports the `id` and the bar's `rect` on the line under the pointer, and `null` when the pointer leaves. [`AttributionCard`](/editor-react/change-review#attributioncard) is a card to show there.

The runs follow their text through edits until the app sets them again, at the cost of one mapping of two offsets per run per edit.

## Remote cursors

`setRemoteCursors(cursors)` draws the caret of an agent with its name in a label: `id`, `position`, `name` and `color`. The label sits above the caret, or under it where there is no room, such as on the first line. A remote cursor follows its text, takes no pointer events, is hidden on a folded line and never moves the editor's own caret.

## Ghost text

`setGhostText(ghost)` draws a suggestion after a position, such as the continuation of a line from a model. The first line of `text` sits in the line, faint and italic, with the caret in front of it. Further lines push the lines below down. `accessory(container)` fills an element after the first line, such as the key that takes the suggestion. `null` removes it, and so does any change of the text.

The editor never accepts a suggestion. The app binds a key, checks that the suggestion still fits, and inserts it:

```ts
editor.setGhostText({ position, text: suggestion });

editor.onKeyDown((event) => {
    if (event.key !== 'Tab') {
        return false;
    }
    return editor.applyEdits([{ range: { start: position, end: position }, text: suggestion }]);
});
```

`acceptGhostWord` in the [key table](/editor/options#keymaps) is a name for a key that takes one word; it has no chord by default and the editor does nothing with it.
