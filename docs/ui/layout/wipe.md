# Wipe

Two versions of one picture in one frame: `before` left of the split and `after` right of it, with a handle between them to drag or move with the arrow keys.

```tsx
import { Wipe } from '@adecore/ui';
```

<Demo src="layout/wipe" />

The wipe fills the positioned element it sits in. `value` is the share of the width left of the handle, from 0 to 1. The handle is a line with a round knob on it by default; `handle="line"` draws the plain line, which a person drags anywhere along its height. The handle keeps its colors in both themes, since it sits on a picture and not on the interface.

## Keyboard

The handle is a `slider` in the tab order. The left and right arrows move it 2 percent, Home and End to either edge. It only answers those keys while it has the focus, and stops them there, so a canvas or a timeline around it never hears them. A screen reader hears the position as a percentage.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value` | `number` | | Required. |
| `onValueChange` | `(value: number) => void` | | Required. |
| `before` | `ReactNode` | | Required. |
| `after` | `ReactNode` | | Required. |
| `label` | `string` | | Required. The slider's accessible name. |
| `handle` | `'knob' \| 'line'` | `'knob'` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`WipeProps` is an exported type.
