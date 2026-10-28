# Tooltip

A hint on hover and on keyboard focus. Every hint in an app is one of these, never a `title` attribute.

```tsx
import { Tooltip } from '@adecore/ui';
```

<Demo src="overlays/tooltip" />

The child is the trigger and must take a ref. Base UI merges the tooltip's props into it.

`kbd` prints a shortcut after the label, or a short phrase such as "Shift skips the cache". A real shortcut also registers with [`ShortcutHints`](/ui/display/shortcut-hints).

`name` makes the label the trigger's accessible name too, as an icon-only button needs. [`IconButton`](/ui/actions/icon-button) does this with its `label`.

A label wraps past 288 pixels.

## Content without a DOM trigger

For a link inside a terminal or a canvas, pass `open`, `onOpenChange` and an `anchor` with `getBoundingClientRect()` in viewport coordinates, and leave out `children`. The popup then ignores the pointer. The host decides when a link is hovered.

```tsx
<Tooltip
    open={hovered !== null}
    onOpenChange={(open) => { if (!open) { setHovered(null); } }}
    anchor={hovered ? { getBoundingClientRect: () => new DOMRect(hovered.x, hovered.y, 0, 0) } : null}
    label="Cmd+click to open"
/>
```

## Delay

Tooltips share one delay through [`UIProvider`](/ui/utilities/ui-provider): 150 milliseconds to open, none to close. After the first tooltip, the next button's opens at once and the tooltip slides over.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `ReactNode` | | Required. |
| `children` | `ReactElement` | | The trigger. Omit for a controlled virtual anchor. |
| `open` | `boolean` | | Controls visibility. |
| `onOpenChange` | `(open: boolean) => void` | | Receives dismissals and trigger changes. |
| `anchor` | `TooltipPositioner.Props['anchor']` | | An element, ref or virtual rectangle. |
| `kbd` | `Shortcut \| string` | | Printed after the label. |
| `side` | `TooltipSide` | `'top'` | `'top' \| 'bottom' \| 'left' \| 'right'` |
| `sideOffset` | `number` | `6` | |
| `name` | `boolean` | `false` | Makes a string label the trigger's `aria-label`. |
| `disabled` | `boolean` | `false` | Keeps the hint closed. |

`TooltipProps` and `TooltipSide` are exported types.
