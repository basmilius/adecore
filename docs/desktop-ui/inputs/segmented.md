# Segmented

One of a few options side by side in one sunken track, the picked one lifted out of it. It suits two to four short options that change what a view shows.

```tsx
import { Segmented } from '@basmilius/desktop-ui';
```

<Demo src="inputs/segmented" />

The track is as wide as its options, also in a `Field` or a column that stretches what it holds.

The track is a `radiogroup` and every option a `radio`, with `aria-checked` on the picked one. Each option is its own button in the tab order.

## Props

| Prop | Type | |
| --- | --- | --- |
| `value` | `T` | Required. |
| `onValueChange` | `(id: T) => void` | Required. |
| `options` | `readonly SegmentedOption<T>[]` | Required. `{ id, label, icon? }`, with a Lucide icon drawn at 14 pixels. |
| `label` | `string` | Required. The accessible name of the group. |
| `disabled` | `boolean` | |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`SegmentedProps` and `SegmentedOption` are exported types.
