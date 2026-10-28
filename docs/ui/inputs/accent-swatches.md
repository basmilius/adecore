# AccentSwatches

An accent picker for a settings row: a few featured swatches, and a menu with every color.

```tsx
import { AccentSwatches } from '@adecore/ui';
```

<Demo src="inputs/accent-swatches" />

A picked color that is not featured shows on the "more colors" swatch, as teal does above. An unknown value picks nothing. The swatches are a `radiogroup`, with each color's name as tooltip.

## Props

`AccentSwatches` is generic over the accent's id, a string type.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `string \| undefined` | | Required. |
| `onValueChange` | `(id: Id) => void` | | Required. |
| `label` | `string` | | Required. The name of the group. |
| `accents` | `readonly { id: Id; color: string }[]` | | Required. Every color, in menu order. |
| `featured` | `readonly Id[]` | | Required. The swatches shown, in order. |
| `labelOf` | `(id: Id) => string` | | Required. A color's name. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`AccentSwatchesProps` is an exported type.
