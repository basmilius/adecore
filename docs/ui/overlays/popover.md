# Popover

A popup of content anchored to a trigger, as a compound component on Base UI's popover. For a list of actions, use a [`Menu`](/ui/overlays/menu).

```tsx
import { Popover } from '@adecore/ui';
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

`variant` sets the surface. `menu`, the default, is the padded menu card. `picker` runs content to the edges, such as a search field over a list. `plain` leaves the surface to you.

<Demo src="overlays/popover-picker" />

## Placement

A popover opens 8 pixels under its trigger, start-aligned. `Popover.Popup` takes the placement props of [`Menu.Popup`](/ui/overlays/menu#placement).

## Keyboard

Focus moves into the popup on open. Escape closes it and focuses the trigger.

`PopoverPopupProps` and `PopupVariant` are exported types.
