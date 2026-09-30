# useColumnResize

A resizable column or row: a handle that drags the size its owner keeps. [`SlidingColumn`](/layout/sliding-column) is built on it, and [`ColumnResizeHandle`](/layout/column-resize-handle) is the handle.

```tsx
import { clampColumnSize, useColumnResize } from '@basmilius/desktop-ui';
```

<Demo src="layout/column-resize-handle" fill />

```tsx
const column = useRef<HTMLElement>(null);
const { startResize } = useColumnResize(column, {
    size: width,
    min: 160,
    max: () => window.innerWidth - 400,
    from: 'left',
    onSize: setWidth
});
```

`from` is the edge the column hangs from, and with it the axis of the drag. A column pinned to the right edge of the window grows as the pointer moves left; one that starts at its own left edge grows as it moves right. `top` and `bottom` do the same for a row.

`startResize` goes on the handle's `onPointerDown`. The handle takes the pointer capture, so the drag keeps going when the pointer leaves the few pixels it is wide. While it lasts the column carries `data-resizing`, so a transition on its size can turn off. Every move calls `onSize` with a whole number held between `min` and `max()`; `max` is read at drag time, so a window resize between two drags counts.

## clampColumnSize

`clampColumnSize({ min, max }, size)` holds a size between the two and rounds it. Run a stored width through it before the first render, since the window may be smaller than it was when the width was saved.

## Options

| Option | Type | |
| --- | --- | --- |
| `size` | `number` | Required. The size now, in whole pixels. |
| `min` | `number` | Required. |
| `from` | `ColumnEdge` | Required. `'left' \| 'right' \| 'top' \| 'bottom'` |
| `onSize` | `(size: number) => void` | Required. |
| `max` | `() => number` | |

`ColumnResizeOptions`, `ColumnResize` and `ColumnEdge` are exported types.
