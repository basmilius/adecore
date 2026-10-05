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

A menu hangs under its trigger, lined up with its start, 6 pixels away, and is at least 200 pixels wide. A submenu sits beside its row, pulled up so its first row lines up with the row that opened it. `Menu.Popup` takes Base UI's placement props (`side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `collisionBoundary`, `collisionAvoidance`, `anchor`, `sticky`, `positionMethod`) to say otherwise. A long menu scrolls inside the room the window leaves it.

Two separators in a row, or one at the top or the bottom of a menu, are hidden. A menu built from rows that each decide whether they appear never shows a stray line.

## Checks and labels

`Menu.Check` puts a tick in a plain row, for a list that reads as a choice but acts on click, or a row with a second line. `kind="radio"` is a bare tick, `kind="checkbox"` a tick in an outlined box, which says the row can be off.

<Demo src="overlays/menu-check" />

## Parts that are not rows

`unstyled` on `Menu.Item`, `Menu.CheckboxItem` and `Menu.RadioItem` leaves the row out: no padding, no highlight and no indicator, only what makes the part an item. The arrow keys still reach it, typing finds it, and picking it closes the menu unless `closeOnClick={false}` says otherwise. It draws its own look and highlight, which Base UI marks with `data-highlighted`, and a checked item with `data-checked`. Use it for an icon button in a heading row, a link at the foot of a menu, a row of segments, or a [`ColorSwatch`](/ui/inputs/color-swatch) in a grid of colors. `Menu.GroupLabel` takes `unstyled` too, for a group that lays out its own heading.

<Demo src="overlays/menu-unstyled" />

Hand the part to another component through `render`, as the icon button does, or give it the classes itself. It takes the accent outline under the keyboard from what it renders, such as `IconButton`, or from `.focus-ring`.

## A row with buttons

`Menu.Row` puts buttons at the end of a row, and the row and its buttons read as one: the whole row lights up under the pointer, and only its outer corners stay round. Its first child is the row itself, a `Menu.Item` or a `Menu.SubmenuTrigger`. Give the group a name with `aria-label`, usually the row's.

`Menu.RowAction` is a button that acts at once. It takes an `icon`, a `label` that is its accessible name and its tooltip, and `onClick`. `closeOnClick={false}` keeps the menu open, for a step whose result the row shows. `iconClassName` reaches the icon, for a fill. `Menu.RowSubmenuTrigger` looks the same and opens a submenu; put it in a `Menu.SubmenuRoot` with a `Menu.Popup`. It has no tooltip, as the submenu opens on the same hover.

<Demo src="overlays/menu-row" />

Every button is an item of the menu, so the arrow keys reach it after its row. Typeahead reads only the row's label, so typing never lands on a button.

## Shortcuts in a row

A [`Kbd`](/ui/display/kbd) inside a row is pushed to the row's end, in the interface font and a faint color. It only prints the shortcut. Bind the key itself once, outside the menu, and let the row and the key call the same function.

## Keyboard

Base UI handles the keyboard. The arrows move, Home and End jump, and typing the start of a label finds its row. The right arrow opens a submenu and the left arrow closes it. Enter or Space picks a row, and Escape closes the menu and puts focus back on the trigger.

Under the keyboard the highlighted row takes the stronger pressed background; under the pointer it takes the lighter hover background and no outline. See [input modality](/ui/guide/principles#input-modality).

## Types

`MenuPopupProps`, `MenuCheckProps`, `MenuLabelProps`, `MenuHintProps`, `MenuRowProps`, `MenuRowActionProps` and `MenuRowSubmenuTriggerProps` are exported types.
