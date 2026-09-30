# Popover

A popup of content anchored to a trigger, as a compound component on Base UI's popover. Use it for something a person reads or fills in; a list of actions is a [`Menu`](/desktop-ui/overlays/menu).

```tsx
import { Popover } from '@basmilius/desktop-ui';
```

<Demo src="overlays/popover" />

## Parts

| Part | What it is |
| --- | --- |
| `Popover.Root` | Holds the open state: `open` and `onOpenChange`, or `defaultOpen`. |
| `Popover.Trigger` | The button that opens it. |
| `Popover.Popup` | The portal, the positioner and the popup in one part. |
| `Popover.Title` | A heading, which names the popup for a screen reader. |
| `Popover.Description` | A sentence that describes it. |
| `Popover.Close` | A button that closes it. |

## Variants

`variant` decides the surface. `menu`, the default, is the padded card menus use. `picker` is a card whose content runs to its edges, such as a search field on top of a list. `plain` leaves the surface to you.

<Demo src="overlays/popover-picker" />

## Placement

A popover opens under its trigger, lined up with its start, 8 pixels away. `Popover.Popup` takes the same placement props as [`Menu.Popup`](/desktop-ui/overlays/menu#placement).

## Keyboard

Opening moves focus into the popup, Escape closes it, and focus goes back to the trigger.

`PopoverPopupProps` and `PopupVariant` are exported types.
