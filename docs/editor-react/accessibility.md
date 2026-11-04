# Accessibility

The features work through the editor's [accessibility methods](/editor/accessibility) and the words of the `editor` namespace, in English and Dutch. Focus stays in the text while a card is open, and the textarea points at the card.

## What a screen reader hears

- The suggestion list and a snippet's choice list are listboxes. While one is open, the textarea points at it with `aria-controls` and at its active option with `aria-activedescendant`, so a screen reader reads the option while focus stays in the text.
- Moving to a problem says its severity and message, such as `Error: Cannot find name`.
- A snippet says `Field 2 of 3` on each field, and `Field 1 of 3, 4 choices` when a field opens a choice list.
- `EditorView` names the fold controls from `language.fold`.
- The [call hierarchy](/editor-react/call-hierarchy#accessibility) is a tree that announces each answer.
- [`DiffView`](/editor-react/diff-view#accessibility) marks changed lines in text.
- A [rendered documentation](/editor-react/rendered-documentation) block is a group named after the first words of its summary.

The symbol picker is a dialog with its own input.

## What has no keyboard route

Inlay hint actions need a pointer; only the tooltip has a keyboard path, through Quick Info. See [inlay hints](/editor-react/hover#inlay-hints). A host that offers those actions adds its own keyboard route.

Nothing here has been tested with a screen reader.
