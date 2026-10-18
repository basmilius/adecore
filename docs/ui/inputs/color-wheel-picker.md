# ColorWheelPicker

A color picked from a wheel, behind a trigger that holds the color in use. The trigger is the one of an outlined [`Select`](/ui/inputs/select), the same height, radius, border and type, so a row with a picker lines up with the rows of selects around it.

```tsx
import { ColorWheelPicker } from '@adecore/ui';
```

<Demo src="inputs/color-wheel-picker" />

The swatches stand on rings, a ring at a time from the outside in, each in its own order from the top and evenly spread, with `center` in the middle if there is one. The outer ring grows when its swatches would not keep a gap between them otherwise. A color is any CSS background, so a swatch can be a gradient of two tones, as above.

While the wheel is open, `onPreviewChange` reports the swatch under the pointer or the focus, so the page can show it before it is picked: the band under the demo does. It reports null once nothing is looked at: when the pointer leaves the wheel, when the wheel closes without a pick, and after a pick, which `onValueChange` reports first. The wheel opens with the focus on the color in use, never on the first swatch, since a swatch with the focus is a preview.

The name of the swatch looked at, or else of the color in use, stands under the wheel, so a swatch carries no tooltip, only its `aria-label`. The color in use wears the ring of a picked [`ColorSwatch`](/ui/inputs/color-swatch) and no tick, which reads as a glitch on a swatch of two tones. The wheel is a `radiogroup` and one tab stop: the arrow keys walk it in its order, Home and End go to its ends, and only Enter, Space or a click picks and closes it. The trigger is named by `label` and the name of the color in use.

## Props

`ColorWheelPicker` is generic over the color's id, a string type.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `Id` | | Required. |
| `onValueChange` | `(id: Id) => void` | | Required. |
| `onPreviewChange` | `(id: Id \| null) => void` | | The swatch looked at while the wheel is open, or null. |
| `label` | `string` | | Required. The accessible name of the trigger and the wheel; the row above usually carries the visible one. |
| `rings` | `readonly (readonly Id[])[]` | | Required. The rings, outermost first, each in its order from the top. |
| `center` | `Id` | | The swatch in the middle. |
| `colorOf` | `(id: Id) => string` | | Required. Any CSS background. |
| `labelOf` | `(id: Id) => string` | | Required. The name of a color, for its swatch, the trigger and the line under the wheel. |
| `disabled` | `boolean` | | |
| `align` | `'start' \| 'end'` | `'start'` | Where the popup lines up with the trigger. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | The trigger. |

`ColorWheelPickerProps` is an exported type.
