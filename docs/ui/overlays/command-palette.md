# CommandPalette

A dialog to jump to anything: a field on top and a list the arrow keys walk. It is a [combobox](/ui/inputs/combobox) in a [dialog](/ui/overlays/dialog) with the list always open, and shares the combobox's rows, groups and notes.

```tsx
import { CommandPalette } from '@adecore/ui';
```

<Demo src="overlays/command-palette" />

The app supplies the rows and binds the shortcut that opens the palette, and holds `open` in its state.

## Parts

| Part | What it is |
| --- | --- |
| `CommandPalette.Root` | The dialog and the combobox in one. `open`, `defaultOpen`, `onOpenChange` and `onOpenChangeComplete` belong to the dialog; every other prop is Base UI's autocomplete (`value`/`onValueChange` for the query, `items`, `filter`, or `filter={null}` to rank yourself). The first row is always highlighted, so Enter always has a row to run. |
| `CommandPalette.Popup` | The surface, 576 pixels wide or 760 with `size="lg"`. It hangs near the top of the window, so it stays put while the list changes height, and focuses the field on open. Its accessible name is "Command palette" (`palette.label`) unless you pass `aria-label`. |
| `CommandPalette.Input` | The field, with a magnifier in front and an Escape hint at the end. `leading` replaces the magnifier, for a mode mark or a back button. `trailing` goes after the text. `escapeHint={false}` hides the hint, `mono` uses the code font. `className` goes to the row around the field; `ref` stays on the input. |
| `CommandPalette.List` | The rows, which scroll while field and footer stay. Accessible name "Results" (`palette.results`). |
| `CommandPalette.Item` | One row, with `icon`, `hint`, `description`, `trailing`, `shortcut` and `unstyled` as in [a combobox row](/ui/inputs/combobox#a-row). `onClick` runs it on click and Enter. |
| `CommandPalette.Group`, `CommandPalette.GroupLabel`, `CommandPalette.Collection` | Rows under a label, as in a combobox. |
| `CommandPalette.Empty` | Shows its children while the list is empty. |
| `CommandPalette.Status` | A live line, such as a search still running. |
| `CommandPalette.Footer` | A row under the list for key hints, a count or a button. |

The palette closes on Escape and on a click outside. A row closes it by setting `open` to false in its `onClick`.

## Ranking

`matchScore(text, query)` scores how well a label matches the query, ignoring case:

| Score  | When                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| `5`    | The text starts with the query.                                                                             |
| `4`    | A word of the text starts with it. A space, a slash, a dot, a dash, an underscore or a colon starts a word. |
| `3`    | Every typed word is somewhere in the text, and the text starts with the first one.                          |
| `2`    | Every typed word is somewhere in the text, in any order.                                                    |
| `1`    | The letters of the query are in the text in order.                                                          |
| `null` | None of these.                                                                                              |

An empty query scores `0` for everything. Sort within a group to keep the groups in order, or across the list for one ranking. To match more than the label, join it with a hint or keywords.

## Modes and keys of its own

A focused row becomes highlighted and focus returns to `CommandPalette.Input`.

For modes, such as a file search beside the commands, keep the mode in app state and swap the `leading` mark, `items` and footer. Extra keys go in `onKeyDown` on `CommandPalette.Input`, which runs before Base UI's handlers:

- Tab can complete the field to the highlighted row.
- Backspace in an empty field can step back out of a mode.
- Cmd+Enter can run the highlighted row another way. Track the row with `onItemHighlighted` on the root and call `event.preventBaseUIHandler()` for keys the app takes.

For a step where Enter should use the typed text until a row is picked, pass `autoHighlight={false}`.

The highlight returns to the first row, and the list to the top, on open, on typing and when the app sets `value`. Rows that change under the same query keep the highlight. The highlight cannot start on another row, so put the row that should open highlighted first.

## Types

`CommandPaletteRootProps`, `CommandPalettePopupProps`, `CommandPaletteInputProps` and `CommandPaletteFooterProps` are exported types.

## Large lists

For a large catalog, use `CommandPalette.VirtualList` instead of `CommandPalette.List` and set `virtualized` on the root. It mounts only the visible rows of the filtered items; rows may vary in height, and the arrow keys still reach every item.

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

Spread `itemProps` onto each item; they carry its position in the whole filtered list. Grouped catalogs pass `groupLabel={(group) => group.label}` and the group type as the second type parameter. It takes the same element props and ref as `CommandPalette.List`.

`CommandPaletteVirtualListProps` and `CommandPaletteVirtualItemProps` are exported types.
