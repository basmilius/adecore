# Segmented

One of a few options side by side in a sunken track, the picked one lifted out of it. It suits two to four short options that change what a view shows. For many views of one thing, or a view with a count, use [`Tabs`](/ui/layout/tabs).

```tsx
import { Segmented } from '@adecore/ui';
```

<Demo src="inputs/segmented" />

The track is as wide as its options, also in a `Field` or a column that stretches what it holds. It is a `radiogroup` and every option a `radio` with `aria-checked`. Each option is its own button in the tab order; arrow keys do not move between them.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `T` | | Required. |
| `onValueChange` | `(id: T) => void` | | Required. |
| `options` | `readonly SegmentedOption<T>[]` | | Required. `{ id, label, icon? }`, with a Lucide icon drawn at 14 pixels. |
| `label` | `string` | | Required. The accessible name of the group. |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`T` is a string type. `SegmentedProps` and `SegmentedOption` are exported types.
