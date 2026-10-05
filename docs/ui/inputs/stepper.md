# Stepper

A number between minus and plus, in one sunken group so the three read as a single control. It suits a value a person nudges, such as a font size, more than one they type.

```tsx
import { Stepper } from '@adecore/ui';
```

<Demo src="inputs/stepper" />

The value stays between `min` and `max`, and each step is rounded to two decimals, so 0.1 plus 0.2 lands on 0.3 and a step below 0.01 does not work. A button turns off at its end of the range. Each button's name includes the stepper's label ("Font size: smaller"), and the number is a polite live region, so a screen reader hears the new value.

The number is written the way the region writes one, with as many places as `step` has: a step of 0.1 shows `1,0×` and `1,5×` in a Dutch region, never `1×`. Pass `decimals` where the places of the step are not the ones to show. The value keeps the width of the wider end of its range, so stepping never moves the buttons. The unit is drawn in the muted text color.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | | Required. |
| `onValueChange` | `(value: number) => void` | | Required. |
| `min` | `number` | | Required. |
| `max` | `number` | | Required. |
| `step` | `number` | | Required. |
| `label` | `string` | | Required. The name of the group. |
| `decimals` | `number` | the places of `step` | Places after the separator, always shown. |
| `unit` | `string` | | Printed right after the number, such as `px` or `%`. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`StepperProps` is an exported type.
