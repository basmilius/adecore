# Accessibility and touch

The editor draws its text in its own DOM, so assistive technology and the on-screen keyboard both reach it through one hidden textarea.

## The textarea

The textarea holds the text around the caret, mirrors the selection and describes the caret's line and column. `aria-label` comes from the `label` option (`Code editor` by default), and the editor sets `aria-multiline`. Give every editor a label in the app's language, such as `Commit message`.

## A list beside the text

`setInputPopup(popup)` points the textarea at a list beside the text, such as suggestions. An `EditorInputPopup` has the id of the list in `controls` and the id of the option Enter takes in `activeDescendant`. It sets `aria-expanded="true"`, `aria-autocomplete="list"`, `aria-controls` and `aria-activedescendant`, and focus stays in the text. `null` removes all four.

```ts
editor.setInputPopup({ controls: 'suggestions', activeDescendant: 'suggestion-3' });

// When the list closes:
editor.setInputPopup(null);
```

The role stays `textbox`, which does not allow `aria-expanded`, so a checker may flag it.

## Saying things

`announce(message)` speaks a sentence through a hidden polite live region, such as the problem the caret moved to. It draws nothing. A sentence repeated is heard twice.

`setLineLabels(labels)` takes a function that gives a zero-based line a hidden sentence in its gutter, such as `Added, new line 12`, or `null` for none. `setLineLabels(null)` removes the labels. A labeled line hides its drawn number and sign from assistive technology, so the sentence must include the number.

## Fold controls

The gutter fold controls are buttons with `aria-expanded` and names like `Fold lines 3 to 9`. The `fold` and `unfold` entries of `EditorMessages` take `{start}` and `{end}` placeholders. Pass them in the `messages` option, or later with `setMessages`, in the app's language. The controls are outside the tab order (`tabindex="-1"`). Keyboard users fold through the [fold commands](/editor/folding#folding).

No screen reader has tested any of this. Only LinkeDOM tests check the attributes.

## Touch

Touch works without setup:

- Dragging scrolls natively (`touch-action: pan-x pan-y pinch-zoom`), with pinch zoom but no double-tap zoom. A drag never selects.
- A tap places the caret and opens the on-screen keyboard. A tap on a line number selects the line.
- A double tap selects the word. A half-second hold selects the word under the finger and then fires `onContextMenu`.
- The textarea asks for plain text: no capitalization, correction or spell checking, `inputmode="text"` and `enterkeyhint="enter"`.
- When the on-screen keyboard resizes the visual viewport, the caret scrolls back into view. This needs `window.visualViewport`.

A pen behaves like a mouse. There are no selection handles. Only LinkeDOM tests with synthesized events cover touch, never a real device.
