# Combobox

A text field that suggests as you type, as a compound component on Base UI's autocomplete. The text stays free; a suggestion only fills the field. To pick from a fixed set, use a [`Select`](/ui/inputs/select) with `searchable`.

```tsx
import { Combobox } from '@adecore/ui';
```

<Demo src="inputs/combobox" />

The demo completes a filter key, then its value. It holds `open` itself to keep the list open while the field has focus.

## Parts

Every part takes Base UI's own props; the library adds the look, portal and placement.

| Part | What it is |
| --- | --- |
| `Combobox.Root` | Base UI's `Autocomplete.Root`. `value` and `onValueChange` hold the text, `items` the suggestions, `filter` how they match (`null` when you filter yourself). `open`, `onOpenChange`, `autoHighlight` and `onItemHighlighted` work as in Base UI. |
| `Combobox.Input` | The field, drawn as an [`Input`](/ui/inputs/input) with `size`, `mono` and `icon`. Inside a [`Field`](/ui/inputs/field) it takes the label and hint. |
| `Combobox.Popup` | Portal, positioner and surface in one. It opens 6 pixels under the field, at least as wide, and takes Base UI's placement props (`side`, `align`, `sideOffset`, ...). |
| `Combobox.List` | The rows. Pass a function of an item to draw the filtered `items`. Accessible name "Suggestions" (`combobox.suggestions`). |
| `Combobox.Item` | One row, drawn as a menu row. Its children are the label. |
| `Combobox.Group`, `Combobox.GroupLabel`, `Combobox.Collection` | Rows under a label. Pass `items` as `{ value, items }` groups and draw each with a `Collection`. |
| `Combobox.Empty` | Shows its children while the list is empty. Needs `items` on the root. |
| `Combobox.Status` | A live line, such as a running search or a result count. |

`Empty` and `Status` take no room while empty.

## A row

| Prop | Type | |
| --- | --- | --- |
| `icon` | `ReactNode` | Before the label, such as a 14px [`Icon`](/ui/display/icon). |
| `hint` | `ReactNode` | Beside the label, smaller and fainter, and the first to truncate: the folder a file sits in. |
| `description` | `ReactNode` | A second line under the label. |
| `trailing` | `ReactNode` | At the end of the row: a state, a count. |
| `shortcut` | `Shortcut` | Printed as a [`Kbd`](/ui/display/kbd) at the end. |
| `unstyled` | `boolean` | Drops the row layout, for rows that lay out themselves. Highlight (`data-highlighted`), Enter and click still work. |

`onClick` runs on click and on Enter. A modifier held with Enter does not reach `onClick`; read Cmd+Enter in the field's `onKeyDown`, with the row from `onItemHighlighted`.

## Suggestions from a request

Pass `filter={null}`, hold the text with `value` and `onValueChange`, and pass the last answer as `items`. Keep it until the next answer lands so the list does not flicker. `Combobox.Status` can say the search is running.

<Demo src="inputs/combobox-async" />

## Keyboard

Typing opens the list. The arrows move the highlight while the caret stays in the field. Enter takes the highlighted row and Escape closes the list. With `autoHighlight`, the first row is highlighted on open.

## Types

`ComboboxInputProps`, `ComboboxPopupProps` and `ComboboxItemProps` are exported types.
