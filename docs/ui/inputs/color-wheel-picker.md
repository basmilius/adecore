# ColorWheelPicker

A color picked from a wheel, behind a trigger that shows the color in use. The trigger matches an outlined [`Select`](/ui/inputs/select), so it lines up with selects around it.

```tsx
import { ColorWheelPicker } from '@adecore/ui';
```

<Demo src="inputs/color-wheel-picker" />

The swatches sit on rings, outermost first, each ring in order from the top, with `center` in the middle. A color is any CSS background, so a swatch can be a gradient.

While the wheel is open, `onPreviewChange` reports the swatch under the pointer or focus, so the page can preview it. It reports null when the pointer leaves, when the wheel closes, and after a pick (which `onValueChange` reports first). The wheel opens with focus on the color in use.

The name of the swatch looked at, or of the color in use, shows under the wheel, so swatches have no tooltip. The color in use wears the ring of a picked [`ColorSwatch`](/ui/inputs/color-swatch). The wheel is a `radiogroup` and one tab stop: arrow keys walk it, Home and End go to its ends, and only Enter, Space or a click picks and closes it. The trigger is named by `label` plus the color's name.

## Props

`ColorWheelPicker` is generic over the color's id, a string type.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `Id` | | Required. |
| `onValueChange` | `(id: Id) => void` | | Required. |
| `onPreviewChange` | `(id: Id \| null) => void` | | The swatch looked at while the wheel is open, or null. |
| `label` | `string` | | Required. The accessible name of the trigger and the wheel. |
| `rings` | `readonly (readonly Id[])[]` | | Required. The rings, outermost first, each in its order from the top. |
| `center` | `Id` | | The swatch in the middle. |
| `colorOf` | `(id: Id) => string` | | Required. Any CSS background. |
| `labelOf` | `(id: Id) => string` | | Required. The name of a color, for its swatch, the trigger and the line under the wheel. |
| `disabled` | `boolean` | | |
| `align` | `'start' \| 'end'` | `'start'` | Where the popup lines up with the trigger. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | The trigger. |

`ColorWheelPickerProps` is an exported type.
