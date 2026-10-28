# Slider

A number picked along a range, where the position says as much as the number, such as a model's temperature. For a value nudged a step at a time, use a [`Stepper`](/ui/inputs/stepper).

```tsx
import { Slider } from '@adecore/ui';
```

<Demo src="inputs/slider" />

The label above the track is the accessible name; the value sits on the right in tabular figures. The arrows move a step, Page Up and Page Down a tenth of the range, Home and End to either end.

The value is controlled. It stays within `min` and `max`, snaps to a step from `min`, and is rounded so 0.2 plus 0.1 lands on 0.3. It shows as many decimals as `step`, unless you pass `decimals`. The `unit` follows the number on screen and for screen readers.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | | Required. |
| `onValueChange` | `(value: number) => void` | | Required. Called on every step and while dragging. |
| `min` | `number` | | Required. |
| `max` | `number` | | Required. |
| `step` | `number` | `1` | |
| `label` | `string` | | Required. |
| `decimals` | `number` | the places of `step` | |
| `unit` | `string` | | Printed right after the number, such as `px` or `%`. |
| `disabled` | `boolean` | | |
| `className` | `string` | | On the root, which fills the width it is given. |
| `ref` | `Ref<HTMLDivElement>` | | |

`SliderProps` is an exported type.
