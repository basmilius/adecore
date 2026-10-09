# Slider

A number picked along a range, for a value where the position in the range says as much as the number: how many agents run at once, or how warm a model answers. A value a person nudges a step at a time is a [`Stepper`](/ui/inputs/stepper).

```tsx
import { Slider } from '@adecore/ui';
```

<Demo src="inputs/slider" />

The label sits on the left above the track and is the slider's accessible name; the value sits on the right in tabular figures, so it does not shift while it changes. The thumb is a range input underneath: the arrows move it a step, Page Up and Page Down a tenth of the range, Home and End to either end. Keyboard focus draws the accent outline around the thumb.

The value is controlled. It stays between `min` and `max`, falls on a step counted from `min`, and arrives rounded to the places of `step` and `min`, so 0.2 plus 0.1 lands on 0.3. It is written the way the region writes a number, with as many places as `step` has; pass `decimals` where those are not the places to show. The unit follows the number on screen and in what a screen reader hears.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | | Required. |
| `onValueChange` | `(value: number) => void` | | Required. Called on every step and while dragging. |
| `min` | `number` | | Required. |
| `max` | `number` | | Required. |
| `step` | `number` | `1` | |
| `label` | `string` | | Required. Shown above the track and read as its name. |
| `decimals` | `number` | the places of `step` | Places after the separator, always shown. |
| `unit` | `string` | | Printed right after the number, such as `px` or `%`. |
| `disabled` | `boolean` | | |
| `className` | `string` | | On the root, which fills the width it is given. |
| `ref` | `Ref<HTMLDivElement>` | | |

`SliderProps` is an exported type.
