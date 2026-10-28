# ZoomControls

The zoom group of a dock or a toolbar: zoom out, the percentage with a menu of presets, zoom in, and fit everything.

```tsx
import { ZoomControls } from '@adecore/ui';
```

<Demo src="layout/zoom-controls" />

The buttons step 10 percent on the rounded readout, so plus and minus return where they started. The readout opens a menu of presets and a fit row. You hold and clamp the zoom; `1` is 100%.

`selection` adds a row that zooms to the selection. Set `enabled: false` while nothing is selected; the row stays, disabled.

`labels` replaces any of the built-in words.

The defaults suit a bottom dock. In a top toolbar, set `size="sm"` and `side="bottom"`.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `zoom` | `number` | | Required. |
| `onZoomChange` | `(zoom: number) => void` | | Required. |
| `onFitAll` | `() => void` | | Required. |
| `presets` | `readonly number[]` | `[25, 50, 75, 100, 150, 200]` | Percentages. |
| `labels` | `ZoomLabels` | | `{ out?, in?, presets?, fit?, fitEverything? }` |
| `shortcuts` | `{ zoomReset?: Shortcut; fitAll?: Shortcut }` | | Printed beside 100% and fit, and in the fit button's tooltip. |
| `selection` | `ZoomSelection` | | `{ label, enabled, onZoom, shortcut? }` |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `side` | `'top' \| 'bottom'` | `'top'` | Where the presets open. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

The shortcuts are only printed; bind the keys yourself. `ZoomControlsProps`, `ZoomLabels` and `ZoomSelection` are exported types.
