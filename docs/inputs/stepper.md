# Stepper

A number between minus and plus, in one sunken group so the three read as a single control. It suits a value a person nudges, such as a font size, more than one they type.

```tsx
import { Stepper } from '@basmilius/react-ui';
```

<Demo src="inputs/stepper" />

The value stays between `min` and `max`, and each step is rounded to two decimals, so 0.1 plus 0.2 lands on 0.3. A button turns off at its end of the range. Each button's name includes the stepper's label ("Font size: smaller"), and the number is a polite live region, so a screen reader hears the new value.

## Props

| Prop | Type | |
| --- | --- | --- |
| `value` | `number` | Required. |
| `onValueChange` | `(value: number) => void` | Required. |
| `min` | `number` | Required. |
| `max` | `number` | Required. |
| `step` | `number` | Required. |
| `label` | `string` | Required. |
| `unit` | `string` | Printed right after the number, such as `px` or `%`. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`StepperProps` is an exported type.
