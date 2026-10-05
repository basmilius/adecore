# Tooltip

A hint on hover and on keyboard focus. Every hint in an app is one of these, never a `title` attribute.

```tsx
import { Tooltip, TooltipProvider } from '@adecore/ui';
```

<Demo src="overlays/tooltip" />

The child is the trigger. It keeps its own props and handlers, and Base UI merges the tooltip's in, so the child has to be an element that takes a ref.

`kbd` prints a shortcut after the label, the way the platform writes it. It can also be a short phrase about a key that is no shortcut, such as "Shift skips the cache". A real shortcut also registers with [`ShortcutHints`](/ui/display/shortcut-hints), so holding the modifier prints it under the trigger.

`name` makes the label the trigger's accessible name as well. That is what an icon-only button needs, and it keeps the name and the tooltip from ever saying two different things. [`IconButton`](/ui/actions/icon-button) already does this with its `label`.

A label stays on one line up to 288 pixels and wraps past that, avoiding one word alone on the last line. Long paths and other unbroken labels break within that width.

## TooltipProvider

Tooltips share one delay, 150 milliseconds to open and none to close, so moving along a row of buttons feels instant after the first. `TooltipProvider` holds that delay. [`UIProvider`](/ui/utilities/ui-provider) mounts it, so you only need it on its own without `UIProvider`.

## Motion

The tooltip slides to the next button instead of blinking out and in, and scales from the side it hangs from. Both drop the motion when Base UI says the tooltip is instant, such as when it moves between triggers faster than the delay.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `ReactNode` | | Required. |
| `children` | `ReactElement` | | Required. The trigger. |
| `kbd` | `Shortcut \| string` | | Printed after the label. |
| `side` | `TooltipSide` | `'top'` | `'top' \| 'bottom' \| 'left' \| 'right'` |
| `sideOffset` | `number` | `6` | |
| `name` | `boolean` | `false` | Makes a string label the trigger's `aria-label`. |
| `disabled` | `boolean` | `false` | Keeps the hint closed, for a trigger that only needs one some of the time. |

`TooltipProps` and `TooltipSide` are exported types.
