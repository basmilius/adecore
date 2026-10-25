# CommandPalette

A dialog to jump to anything: a field across the top and a list under it that the arrow keys walk. It is a [combobox](/ui/inputs/combobox) in a [dialog](/ui/overlays/dialog), with the list always open; its rows, groups and notes are the combobox's own.

```tsx
import { CommandPalette } from '@adecore/ui';
```

<Demo src="overlays/command-palette" />

The rows, where they come from and the shortcut that opens the palette stay with the app. Bind the shortcut where the app binds its other keys, and hold `open` in its state.

## Parts

| Part                                                                             | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CommandPalette.Root`                                                            | The dialog and the combobox in one. `open`, `defaultOpen`, `onOpenChange` and `onOpenChangeComplete` are the dialog's. Every other prop is Base UI's autocomplete: `value` and `onValueChange` hold the query, `items` the rows, `filter` how they match (`null` when the app ranks them itself). The first row is highlighted (`autoHighlight="always"`) and stays so when the pointer leaves the list (`keepHighlight`), so Enter always has a row to run. |
| `CommandPalette.Popup`                                                           | The dialog's surface, 576 pixels wide or 760 with `size="lg"`, for rows that are lines of source. It hangs from a line near the top of the window instead of the middle: the list changes height with every key, and a centered popup would walk up and down the screen. It puts the focus in the field when it opens. Its accessible name is "Command palette" from the `ui` namespace (`palette.label`); `aria-label` names it otherwise.                  |
| `CommandPalette.Input`                                                           | The field across the top, with a magnifier in front and the Escape key at its end. `leading` takes the place of the magnifier, such as the mark of a mode or a button back. `trailing` goes after the text, such as the toggles of a search or a button that uses what was typed. `escapeHint={false}` leaves the Escape key out, `mono` sets the text in the code font. `className` goes to the row around the field; `ref` stays on the input.             |
| `CommandPalette.List`                                                            | The rows, which scroll on their own while the field and the footer stay. Its accessible name is "Results" (`palette.results`).                                                                                                                                                                                                                                                                                                                               |
| `CommandPalette.Item`                                                            | One row, with `icon`, `hint`, `description`, `trailing`, `shortcut` and `unstyled` as in [a combobox row](/ui/inputs/combobox#a-row). `onClick` runs it, for a click and for Enter.                                                                                                                                                                                                                                                                          |
| `CommandPalette.Group`, `CommandPalette.GroupLabel`, `CommandPalette.Collection` | A group of rows under a label, as in a combobox.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `CommandPalette.Empty`                                                           | Shows its children while the list has no rows.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `CommandPalette.Status`                                                          | A line read out as it changes: a search still running, a step that waits for a machine.                                                                                                                                                                                                                                                                                                                                                                      |
| `CommandPalette.Footer`                                                          | A row under the list for the keys that work here, a count, or a button that leaves the palette.                                                                                                                                                                                                                                                                                                                                                              |

The palette closes on Escape and on a click outside it, like any dialog. A row closes it by setting `open` to false in its `onClick`.

## Ranking

`matchScore(text, query)` says how well a label answers to what was typed, ignoring case:

| Score  | When                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| `5`    | The text starts with the query.                                                                             |
| `4`    | A word of the text starts with it. A space, a slash, a dot, a dash, an underscore or a colon starts a word. |
| `3`    | Every typed word is somewhere in the text, and the text starts with the first one.                          |
| `2`    | Every typed word is somewhere in the text, in any order.                                                    |
| `1`    | The letters of the query are in the text in order.                                                          |
| `null` | None of these.                                                                                              |

An empty query matches everything with `0`. Sort by it within a group to keep the groups in their order, as the demo does, or across the list for one ranked list. Match against more than the label by joining it with what the row also answers to, such as a hint or a few keywords.

## Modes and keys of its own

When a row in `CommandPalette.List` receives focus, it becomes highlighted and focus immediately returns to `CommandPalette.Input`, after the app's list focus handlers run.

A palette with modes, such as a file search beside the commands, keeps the mode in its own state and draws the field and the list for it: another `leading` mark, other `items`, another footer. Keys the palette does not know go in `onKeyDown` on `CommandPalette.Input`, which runs before Base UI's own:

- Tab can complete the field to the highlighted row.
- Backspace in an empty field can step back out of a mode.
- Cmd+Enter can run the highlighted row another way, such as in a new window. Base UI clicks the row for Enter without the modifier, so follow the highlighted row with `onItemHighlighted` on the root and call `event.preventBaseUIHandler()` for the keys the app takes.

For a step where Enter should use what was typed until a row is picked, pass `autoHighlight={false}`.

The highlight starts on the first row when the palette opens, when a person types and when the app sets `value` itself, such as Tab completing the field or Enter on a folder that shows its contents; the list scrolls back to the top with it. Rows that change under the same query, such as results that arrive later, keep the highlight where it was. Base UI's autocomplete has no way to start it on another row, so a step that should open on a given row, such as the one in use, puts that row first.

## Types

`CommandPaletteRootProps`, `CommandPalettePopupProps`, `CommandPaletteInputProps` and `CommandPaletteFooterProps` are exported types.


## Large lists

Use `CommandPalette.VirtualList` instead of `CommandPalette.List` for a large catalog, and set `virtualized` on the root. It reads the root's filtered items and mounts the visible rows with a small buffer. Every item remains available to the arrow keys. Rows are measured so their height can vary, and keyboard highlighting scrolls the target into view.

```tsx
<CommandPalette.Root virtualized items={items}>
    <CommandPalette.Popup>
        <CommandPalette.Input aria-label="Find a command" />
        <CommandPalette.Empty>No matching command</CommandPalette.Empty>
        <CommandPalette.VirtualList<Command>>
            {(command, itemProps) => (
                <CommandPalette.Item {...itemProps} value={command} onClick={command.run}>
                    {command.label}
                </CommandPalette.Item>
            )}
        </CommandPalette.VirtualList>
    </CommandPalette.Popup>
</CommandPalette.Root>
```

Spread `itemProps` onto each item. They carry its flat `index`, `aria-posinset` and `aria-setsize`, so positions refer to the whole filtered list. Grouped catalogs pass `groupLabel={(group) => group.label}` and the group type as the second type parameter. A visible group's label remains accessible when its heading scrolls out of view. The component accepts the same element props and ref as `CommandPalette.List`.

`CommandPaletteVirtualListProps` and `CommandPaletteVirtualItemProps` are exported types. Existing palettes using `List` keep their rendering behavior.
