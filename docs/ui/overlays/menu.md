# Menu

A dropdown menu of actions, as a compound component on Base UI's menu. Every part takes Base UI's own props; the library adds the look, the portal and the placement.

```tsx
import { Menu } from '@adecore/ui';
```

<Demo src="overlays/menu" />

## Parts

| Part | What it is |
| --- | --- |
| `Menu.Root` | Holds the open state. Takes `open`, `onOpenChange` and `defaultOpen`, or keeps the state itself. |
| `Menu.Trigger` | The button that opens the menu, usually handed to an [`IconButton`](/ui/actions/icon-button) or a [`Button`](/ui/actions/button) through `render`. |
| `Menu.Popup` | The portal, the positioner and the popup in one part. |
| `Menu.Item` | A row that acts. `onClick` runs it, `disabled` grays it out, and `closeOnClick={false}` keeps the menu open. `unstyled` makes it an item that is no row (below). |
| `Menu.CheckboxItem` | A row that is on or off, with `checked` and `onCheckedChange`. Draws its box before the label, or at the end with `indicator="end"`. |
| `Menu.RadioGroup`, `Menu.RadioItem` | One of several. The group takes `value` and `onValueChange`, each item a `value`. `indicator="end"` puts the tick at the end of the row. |
| `Menu.Group`, `Menu.GroupLabel` | A group of rows under a label a screen reader reads as the group's name. |
| `Menu.Label` | A label above rows that are not a group of their own, such as a row of swatches. |
| `Menu.Separator` | The hairline between groups. |
| `Menu.Hint` | A quiet note at the end of a row about what the item does. A shortcut is a [`Kbd`](/ui/display/kbd) instead. |
| `Menu.Check` | The tick slot of a row that shows a state but is not a checkbox or radio item. |
| `Menu.SubmenuRoot`, `Menu.SubmenuTrigger` | A row that opens another menu beside it. Put a `Menu.Popup` inside the `SubmenuRoot`. The trigger ends in a chevron; `chevron={false}` leaves it off for a row that ends in a hint. |
| `Menu.Row`, `Menu.RowAction`, `Menu.RowSubmenuTrigger` | A row with buttons at its end (below). |

## Placement

A menu opens under its trigger, start-aligned, 6 pixels away and at least 200 pixels wide. A submenu lines its first row up with the row that opened it. `Menu.Popup` takes Base UI's placement props (`side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `collisionBoundary`, `collisionAvoidance`, `anchor`, `sticky`, `positionMethod`). A long menu scrolls.

Doubled separators, and separators at the top or bottom, are hidden, so conditional rows never leave a stray line.

## Checks and labels

`Menu.Check` puts a tick in a plain row, for a choice that acts on click or a row with a second line. `kind="radio"` is a bare tick; `kind="checkbox"` boxes it, saying the row can be off.

<Demo src="overlays/menu-check" />

## Parts that are not rows

`unstyled` on `Menu.Item`, `Menu.CheckboxItem` and `Menu.RadioItem` drops the row's padding, highlight and indicator. The part stays an item: arrow keys and typeahead reach it, and picking it closes the menu unless `closeOnClick={false}`. Style it yourself on `data-highlighted` and `data-checked`. Use it for an icon button in a heading row, a link at the foot, or a [`ColorSwatch`](/ui/inputs/color-swatch) in a grid. `Menu.GroupLabel` takes `unstyled` too.

<Demo src="overlays/menu-unstyled" />

Hand the part to another component through `render`, or give it classes. Its keyboard outline comes from what it renders, such as `IconButton`, or from `.focus-ring`.

## A row with buttons

`Menu.Row` puts buttons at the end of a row, and the row highlights as one. Its first child is the row itself, a `Menu.Item` or a `Menu.SubmenuTrigger`. Name the group with `aria-label`, usually the row's label.

`Menu.RowAction` acts at once. It takes an `icon`, a `label` (accessible name and tooltip) and `onClick`. `closeOnClick={false}` keeps the menu open. `iconClassName` reaches the icon. `Menu.RowSubmenuTrigger` looks the same and opens a submenu; put it in a `Menu.SubmenuRoot` with a `Menu.Popup`. It has no tooltip.

<Demo src="overlays/menu-row" />

The arrow keys reach each button after its row. Typeahead reads only the row's label.

## Shortcuts in a row

A [`Kbd`](/ui/display/kbd) in a row sits at its end, faint. It only prints the shortcut; bind the key once outside the menu and call the same function.

## Keyboard

| Key | Action |
| --- | --- |
| Arrow up, Arrow down | Move |
| Home, End | Jump to the first or last row |
| Typing | Find a row by its label |
| Arrow right, Arrow left | Open or close a submenu |
| Enter, Space | Pick the row |
| Escape | Close and focus the trigger |

See [input modality](/ui/guide/principles#input-modality) for how the highlight differs under keyboard and pointer.

## Types

`MenuPopupProps`, `MenuCheckProps`, `MenuLabelProps`, `MenuHintProps`, `MenuRowProps`, `MenuRowActionProps` and `MenuRowSubmenuTriggerProps` are exported types.
