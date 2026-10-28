# Meter

A level against a scale, read at a glance: how full it is, and where a target or a limit sits on the same scale. Loudness against a target, storage against a quota, a budget against its limit.

```tsx
import { Meter } from '@adecore/ui';
```

<Demo src="display/meter" />

`value` is clamped between `min` and `max`. `null` draws an empty track, for a level not measured yet. `marks` draws a line across the track at each value, such as a target or a limit.

```tsx
<Meter value={loudness} min={-40} max={-4} marks={[-14]} label="Momentary loudness" valueText={`${formatDecimal(loudness)} LUFS`} />
```

It is a thin bar with no width of its own: `className` gives it one, or a flex row stretches it. It draws only the bar; you lay out the name and value. The fill has no transition, so fast updates follow without lag.

A screen reader hears a meter named by `label`, with `valueText` as the value ("-18.2 LUFS", "Measuring"), or else the number.

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
