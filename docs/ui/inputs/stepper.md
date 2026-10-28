# Stepper

A number between minus and plus buttons in one sunken group, for a value a person nudges, such as a font size.

```tsx
import { Stepper } from '@adecore/ui';
```

<Demo src="inputs/stepper" />

The value stays within `min` and `max`. Steps round to two decimals, so a step below 0.01 does not work. A button disables at its end of the range. Button names include the label ("Font size: smaller"), and the number is a live region.

The number shows as many decimals as `step` (a step of 0.1 shows `1,0×` in a Dutch region), unless you pass `decimals`. Its width stays fixed, so the buttons never move.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | | Required. |
| `onValueChange` | `(value: number) => void` | | Required. |
| `min` | `number` | | Required. |
| `max` | `number` | | Required. |
| `step` | `number` | | Required. |
| `label` | `string` | | Required. The name of the group. |
| `decimals` | `number` | the places of `step` | |
| `unit` | `string` | | Printed after the number, muted, such as `px` or `%`. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`StepperProps` is an exported type.
