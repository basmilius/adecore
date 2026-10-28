# ZoomControls

The zoom group of a dock or a toolbar: zoom out, the percentage with a menu of presets, zoom in, and fit everything.

```tsx
import { ZoomControls } from '@adecore/ui';
```

<Demo src="layout/zoom-controls" />

The buttons step 10 percent at a time on the rounded percentage the readout shows, so plus and minus come back where they started. The readout opens a menu of presets that ticks the current one, and a row that fits everything. You keep the zoom and clamp it; `1` is 100%.

`selection` adds a menu row for zooming to what is selected. Leave it out on a surface with nothing to select. When nothing is selected, set `enabled: false`. The row stays and says it cannot act, rather than doing nothing.

The default presets are `[25, 50, 75, 100, 150, 200]`. The words come from the library in English or Dutch; `labels` replaces any of them with your own.

The defaults suit a dock at the bottom: buttons of size `md` and presets that open above. In a toolbar at the top, set `size="sm"` to match its small buttons and `side="bottom"` so the presets open below it.

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
| `size` | `'md' \| 'sm'` | `'md'` | The size of the buttons, and the readout to match. |
| `side` | `'top' \| 'bottom'` | `'top'` | Where the presets open. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

The shortcuts are only printed. Bind the keys on the window yourself. `ZoomControlsProps`, `ZoomLabels` and `ZoomSelection` are exported types.
