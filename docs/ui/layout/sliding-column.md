# SlidingColumn

A panel that slides in along the right edge of a view, resized by dragging its left edge.

```tsx
import { SlidingColumn } from '@adecore/ui';
```

<Demo src="layout/sliding-column" fill />

Closed, the column is 0 pixels wide and inert. The contents keep the stored width while it slides, so they do not reflow, and stay mounted until a close finishes.

You hold the width. During a drag, `onWidthChange` reports whole pixels within `bounds.min` and `bounds.max()`. Clamp a stored width yourself with [`clampColumnSize`](/ui/hooks/use-column-resize#clampcolumnsize) before passing it in.

`instant` skips the animation, for a width restored on page load.

## Space between panels

`gap={8}` replaces the left border with 8 pixels of `--separator` space, which the resize handle fills. `width`, `bounds` and `onWidthChange` measure the surface alone, so an open column takes `width + gap` pixels.

## A column with shortcuts

`body` hands the column the keyboard. The inner column gets `tabIndex={-1}`, so code can move focus into it, and its `onKeyDown` hears keys while focus is inside.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | | Required. |
| `width` | `number` | | Required. In pixels, already clamped. |
| `gap` | `number` | `0` | Space before the surface, in whole pixels. |
| `bounds` | `{ min: number; max(): number }` | | Required. `max` is read at drag time. |
| `onWidthChange` | `(width: number) => void` | | Required. |
| `instant` | `boolean` | `false` | |
| `body` | `{ ref: RefObject<HTMLDivElement \| null>; onKeyDown(event): void }` | | |
| `children` | `ReactNode` | | |
| `className` | `string` | | On the outer column. |
| `ref` | `Ref<HTMLElement>` | | The outer column, for bounds that measure what is beside it. |

`SlidingColumnProps` is an exported type.
