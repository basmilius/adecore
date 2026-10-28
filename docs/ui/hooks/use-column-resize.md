# useColumnResize

A resizable column or row: a handle that drags the size its owner keeps. [`SlidingColumn`](/ui/layout/sliding-column) is built on it, and [`ColumnResizeHandle`](/ui/layout/column-resize-handle) is the handle.

```tsx
import { clampColumnSize, useColumnResize } from '@adecore/ui';
```

<Demo src="hooks/use-column-resize" fill />

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

`from` is the edge the column hangs from, and with it the axis of the drag. A column pinned to the right edge grows as the pointer moves left. `top` and `bottom` do the same for a row, as in the demo.

`startResize` goes on the handle's `onPointerDown`. During a drag the column carries `data-resizing`, so a transition on its size can turn off. Every move calls `onSize` with a whole number between `min` and `max()`. `max` is read at drag time.

## clampColumnSize

`clampColumnSize({ min, max }, size)` rounds a size and holds it between `min` and `max()`. Run a stored width through it before the first render, since the window may have shrunk since it was saved.

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` | | Required. The size now, in whole pixels. |
| `min` | `number` | | Required. |
| `from` | `ColumnEdge` | | Required. `'left' \| 'right' \| 'top' \| 'bottom'` |
| `onSize` | `(size: number) => void` | | Required. Called on every move. |
| `max` | `() => number` | no limit | Read at drag time. |

`ColumnResizeOptions`, `ColumnResize` and `ColumnEdge` are exported types.
