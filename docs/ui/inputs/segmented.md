# Segmented

One of a few options side by side in a sunken track, the picked one raised. It suits two to four short options that change what a view shows. For views with a count, use [`Tabs`](/ui/layout/tabs).

```tsx
import { Segmented } from '@adecore/ui';
```

<Demo src="inputs/segmented" />

The track is as wide as its options, even in a stretching container. Long labels wrap. With `orientation="vertical"` the options stack in a column as wide as its container.

It is a `radiogroup` of `radio` options and one tab stop: the picked option, or the first. The arrow keys pick the next or previous option and wrap, Home and End pick the first and last, and Space or a click picks the focused one.

## Icons only

With `iconOnly` each option is a square with its icon, and the label becomes its accessible name and tooltip. Give every option an icon; one without keeps its label.

<Demo src="inputs/segmented-icons" />

## A disabled option

An option with `disabled: true` is dimmed and skipped by the keyboard and the tab stop.

<Demo src="inputs/segmented-disabled" />

## Sizes

`size="md"` is 32 pixels high and `size="sm"` 28, matching `Input`, `Select` and `Button`. At `sm` the icons are 12 pixels.

<Demo src="inputs/segmented-size" />

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `T` | | Required. |
| `onValueChange` | `(id: T) => void` | | Required. |
| `options` | `readonly SegmentedOption<T>[]` | | Required. `{ id, label, icon?, disabled? }`, with a Lucide icon drawn at 14 pixels, 12 at `sm`. |
| `label` | `string` | | Required. The accessible name of the group. |
| `disabled` | `boolean` | | |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `iconOnly` | `boolean` | `false` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`T` is a string type. `SegmentedProps` and `SegmentedOption` are exported types.
