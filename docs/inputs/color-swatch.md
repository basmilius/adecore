# ColorSwatch

One color, drawn as the color itself. Its name belongs in a tooltip, so a picked swatch carries only a tick.

```tsx
import { ColorSwatch } from '@basmilius/desktop-ui';
```

<Demo src="inputs/color-swatch" />

Without a `color` the swatch is an outlined circle: no color at all, or the button that opens the rest of a palette. Children replace the tick, such as an ellipsis on a "more colors" swatch. `on="popup"` tightens the ring of a picked swatch for one inside a popup.

`ColorSwatch` is a button. For a row of them, give the row `role="radiogroup"` and each swatch `role="radio"` and `aria-checked`, as the demo does, or use [`AccentSwatches`](/inputs/accent-swatches), which does it for you.

In a menu, make each swatch an item that is no row with `render={<Menu.Item unstyled />}`. The arrow keys reach it and picking it closes the menu, while the row's padding and highlight stay off the circle; the swatch draws the accent outline under the keyboard itself. See the swatches in [Menu](/overlays/menu#checks-and-labels).

## Props

`ColorSwatch` takes every prop of a `<button>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `color` | `string` | | Any CSS color. |
| `picked` | `boolean` | `false` | |
| `on` | `'surface' \| 'popup'` | `'surface'` | What the swatch stands on, which the ring is offset against. |
| `render` | `RenderProp` | | Another element to be the swatch, such as a menu trigger or `<Menu.Item unstyled />`. |

`ColorSwatchProps` is an exported type.
