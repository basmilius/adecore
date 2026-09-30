# Meter

A level against a scale, read at a glance: how full it is, and where a target or a limit sits on the same scale. Loudness against a target, storage against a quota, a budget against its limit.

```tsx
import { Meter } from '@basmilius/desktop-ui';
```

<Demo src="display/meter" />

`value` sits between `min` and `max`, 0 and 100 unless you set them, and a level past either end is held to it. `null` draws the track without a fill, for a level not measured yet. `marks` draws a line across the track at each value, such as a target or a limit.

```tsx
<Meter value={loudness} min={-40} max={-4} marks={[-14]} label="Momentary loudness" valueText={`${formatDecimal(loudness)} LUFS`} />
```

It is a thin bar of 6 pixels and has no width of its own: `className` gives it one, or a flex row stretches it. It draws only the bar, so the name and the value beside it are yours to lay out, and two meters stack in a toolbar row. The fill has no transition, so a level that updates many times a second follows without lag.

A screen reader hears it as a meter named by `label`. `valueText` is what it hears as the value, such as "-18.2 LUFS" or "Measuring"; without it, it hears the number.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number \| null` | | Required. `null` draws an empty track. |
| `label` | `string` | | Required. The name a screen reader reads. |
| `min` | `number` | `0` | |
| `max` | `number` | `100` | |
| `marks` | `readonly number[]` | `[]` | Values drawn as lines across the track. |
| `valueText` | `string` | | The value in words for a screen reader. |
| `className` | `string` | | Its width. |
| `ref` | `Ref<HTMLDivElement>` | | |

`MeterProps` is an exported type.
