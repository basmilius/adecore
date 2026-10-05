# ColumnResizeHandle

An invisible strip over the free edge of a column or a row, which starts a drag from [`useColumnResize`](/ui/hooks/use-column-resize). The column needs `position: relative` and draws its own border.

```tsx
import { ColumnResizeHandle, useColumnResize } from '@adecore/ui';
```

<Demo src="layout/column-resize-handle" fill />

`from` is the edge the column hangs from, the same value you hand the hook; the handle is an 8 pixel strip on the opposite edge, with a resize cursor. It takes the pointer only and is not in the tab order, so a size that has to be reachable from the keyboard needs another way in, such as a setting.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `from` | `ColumnEdge` | | Required. `'left' \| 'right' \| 'top' \| 'bottom'` |
| `onPointerDown` | `(event: PointerEvent) => void` | | Required. `startResize` from the hook. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`ColumnResizeHandleProps` is an exported type.
