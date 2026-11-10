# SlidingColumn

A panel that slides in along the right edge of a view, resized by dragging its left edge. With `side="left"` it stands along the left edge and drags by its right one. The edge it drags by shows an accent line while the pointer is on it or a drag runs.

```tsx
import { SlidingColumn } from '@adecore/ui';
```

<Demo src="layout/sliding-column" fill />

Closed, the column is 0 pixels wide and inert. The contents keep the stored width while it slides, so they do not reflow, and stay mounted until a close finishes.

You hold the width. During a drag, `onWidthChange` reports whole pixels within `bounds.min` and `bounds.max()`. Clamp a stored width yourself with [`clampColumnSize`](/ui/hooks/use-column-resize#clampcolumnsize) before passing it in.

`instant` skips the animation, for a width restored on page load.

## Space between panels

`gap={8}` replaces the border on the free edge with 8 pixels of `--separator` space, which the resize handle fills. `width`, `bounds` and `onWidthChange` measure the column alone, so an open column takes `width + gap` pixels.

## A column with shortcuts

`body` hands the column the keyboard. The inner column gets `tabIndex={-1}`, so code can move focus into it, and its `onKeyDown` hears keys while focus is inside.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | | Required. |
| `side` | `'left' \| 'right'` | `'right'` | The edge of the view the column stands against. |
| `width` | `number` | | Required. In pixels, already clamped. |
| `gap` | `number` | `0` | Space on the free edge of the column, in whole pixels. |
| `edge` | `boolean` | `true` | The border on the free edge without a gap. Off in a `Workspace` side panel, whose left edge is the sheet's. |
| `bounds` | `{ min: number; max(): number }` | | Required. `max` is read at drag time. |
| `onWidthChange` | `(width: number) => void` | | Required. |
| `instant` | `boolean` | `false` | |
| `body` | `{ ref: RefObject<HTMLDivElement \| null>; onKeyDown(event): void }` | | |
| `children` | `ReactNode` | | |
| `className` | `string` | | On the outer column. |
| `ref` | `Ref<HTMLElement>` | | The outer column, for bounds that measure what is beside it. |

`SlidingColumnProps` is an exported type.
