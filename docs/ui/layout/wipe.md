# Wipe

Two versions of one picture in one frame: `before` left of the split and `after` right of it, with a handle between them to drag or move with the arrow keys.

```tsx
import { Wipe } from '@adecore/ui';
```

<Demo src="layout/wipe" />

The wipe fills its positioned parent. `value` is the share of the width left of the handle, from 0 to 1. The handle is a line with a round knob; `handle="line"` draws only the line, draggable along its height. Its colors are the same in both themes.

## Keyboard

The handle is a `slider` in the tab order. Left and right arrows move it 2 percent, Home and End to either edge. It stops those keys from reaching surrounding handlers.

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
