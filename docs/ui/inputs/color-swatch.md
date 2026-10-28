# ColorSwatch

One color, drawn as the color itself. A picked swatch shows a tick.

```tsx
import { ColorSwatch } from '@adecore/ui';
```

<Demo src="inputs/color-swatch" />

Without a `color` the swatch is an outlined circle, for "no color" or a "more colors" button. Children replace the tick, such as an ellipsis. `tick={false}` leaves the ring alone to mark the pick, for a two-tone swatch. `on="popup"` tightens the ring inside a popup.

Give each swatch an `aria-label` and a [`Tooltip`](/ui/overlays/tooltip) with the name. For a row, give it `role="radiogroup"` and each swatch `role="radio"` and `aria-checked`, or use [`AccentSwatches`](/ui/inputs/accent-swatches) or [`ColorWheelPicker`](/ui/inputs/color-wheel-picker).

In a menu, render each swatch as `render={<Menu.Item unstyled />}`. See [Menu](/ui/overlays/menu#checks-and-labels).

## Props

`ColorSwatch` takes every prop of a `<button>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `color` | `string` | | Any CSS color. |
| `picked` | `boolean` | `false` | |
| `tick` | `boolean` | `true` | Whether a picked swatch draws its tick. |
| `on` | `'surface' \| 'popup'` | `'surface'` | What the swatch stands on. |
| `render` | `RenderProp` | | Such as a menu trigger or `<Menu.Item unstyled />`. |

`ColorSwatchProps` is an exported type.
