# AccentSwatches

An accent picker, a few colors at a time. A full palette is more than a settings row can carry, so a handful stand in the open and a menu behind them holds every color, the featured ones included.

```tsx
import { AccentSwatches } from '@basmilius/react-ui';
```

<Demo src="inputs/accent-swatches" />

Teal is picked above but not featured, so the "more colors" swatch wears it. A value that is no accent at all picks nothing.

## Props

`AccentSwatches` is generic over the accent's id, a string type.

| Prop | Type | |
| --- | --- | --- |
| `value` | `string \| undefined` | Required. |
| `onValueChange` | `(id: Id) => void` | Required. |
| `label` | `string` | Required. The name of the group. |
| `accents` | `readonly { id: Id; color: string }[]` | Required. Every color on offer, in the order of the menu. |
| `featured` | `readonly Id[]` | Required. The few drawn in the open, in the order they stand. |
| `labelOf` | `(id: Id) => string` | Required. The name of a color, for its tooltip and its menu row. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`AccentSwatchesProps` is an exported type.
