# Menu

A dropdown menu of actions, as a compound component on Base UI's menu. Every part takes Base UI's own props; the library adds the look, the portal and the placement.

```tsx
import { Menu } from '@basmilius/desktop-ui';
```

<Demo src="overlays/menu" />

## Parts

| Part | What it is |
| --- | --- |
| `Menu.Root` | Holds the open state. Takes `open`, `onOpenChange` and `defaultOpen`, or keeps the state itself. |
| `Menu.Trigger` | The button that opens the menu. Usually handed to an [`IconButton`](/desktop-ui/actions/icon-button) or a [`Button`](/desktop-ui/actions/button) through `render`. |
| `Menu.Popup` | The portal, the positioner and the popup in one part. |
| `Menu.Item` | A row that acts. `onClick` runs it, `disabled` grays it out, and `closeOnClick={false}` keeps the menu open. `unstyled` makes it an item that is no row (below). |
| `Menu.CheckboxItem` | A row that is on or off, with the box before its label drawn for you. `checked` and `onCheckedChange`. `indicator="end"` puts the box at the end of the row. |
| `Menu.RadioGroup`, `Menu.RadioItem` | One of several. The group takes `value` and `onValueChange`, each item a `value`. `indicator="end"` puts the tick at the end of the row. |
| `Menu.Group`, `Menu.GroupLabel` | A group of rows under a label a screen reader reads as the group's name. |
| `Menu.Label` | A label above rows that are not a group of their own, such as a row of swatches. |
| `Menu.Separator` | The hairline between groups. |
| `Menu.Hint` | A quiet trailing note in a row about what the item does. A shortcut is a [`Kbd`](/desktop-ui/display/kbd) instead. |
| `Menu.Check` | The tick slot of a row that shows a state but is not a checkbox or radio item. |
| `Menu.SubmenuRoot`, `Menu.SubmenuTrigger` | A row that opens another menu beside it, with a chevron at its end. Put a `Menu.Popup` inside the `SubmenuRoot`. |

## Placement

A menu hangs under its trigger, lined up with its start, 6 pixels away. A submenu sits beside its row, pulled up so its first row lines up with the row that opened it. `Menu.Popup` takes Base UI's placement props (`side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `collisionBoundary`, `collisionAvoidance`, `anchor`, `sticky`, `positionMethod`) to say otherwise. A long menu scrolls inside the room the window leaves it.

Separators take care of themselves. Two in a row, or one at the top or the bottom of a menu, are hidden. A menu built from rows that each decide whether they appear never shows a stray line.

## Checks and labels

`Menu.Check` puts a tick in a plain row, for a list that reads as a choice but acts on click, or a row with a second line. `kind="radio"` is a bare tick, `kind="checkbox"` a tick in an outlined box, which says the row can be off.

<Demo src="overlays/menu-check" />

A checkbox or radio item draws its indicator before the label. `indicator="end"` moves it to the end of the row, for an option that reads as a label with its control after it, such as a setting among others that keep their control at the end. The Previews row in the [next demo](#parts-that-are-not-rows) is one.

## Parts that are not rows

`unstyled` on `Menu.Item`, `Menu.CheckboxItem` and `Menu.RadioItem` leaves the row out: no padding, no highlight and no indicator, only what makes the part an item. The arrow keys still reach it, typing finds it, and picking it closes the menu unless `closeOnClick={false}` says otherwise. It draws its own look and its own highlight, which Base UI marks with `data-highlighted` and a checked item with `data-checked`. Use it for an icon button in a heading row, a link at the foot of a menu, a row of segments, or a [`ColorSwatch`](/desktop-ui/inputs/color-swatch) in a grid of colors. `Menu.GroupLabel` takes `unstyled` too, for a group that lays out its own heading.

<Demo src="overlays/menu-unstyled" />

Hand the part to another component through `render`, as the icon button does, or give it the classes itself. A part that is no row still takes the accent outline under the keyboard from what it renders, such as `IconButton`, or from `.focus-ring`; under the pointer the theme hides that outline, as it does for a row.

## Shortcuts in a row

A [`Kbd`](/desktop-ui/display/kbd) inside a row is pushed to the row's end in the interface font and a faint color. The shortcut is only printed there. Bind the key itself on the window, once, and let the menu row and the key call the same function.

## Keyboard

Enter, Space or the down arrow on the trigger opens the menu with the first row highlighted. The arrows move, Home and End jump, and typing the start of a label finds its row. The right arrow opens a submenu and the left arrow closes it. Enter or Space picks a row, Escape closes the menu, and focus goes back to the trigger.

Under the keyboard the highlighted row carries the stronger pressed background; under the pointer a lighter hover background and no outline. See [input modality](/desktop-ui/guide/principles#input-modality).

## Types

`MenuPopupProps`, `MenuCheckProps`, `MenuLabelProps` and `MenuHintProps` are exported types.
