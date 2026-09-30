# ColumnResizeHandle

An invisible strip over the free edge of a column or a row, which starts a drag from [`useColumnResize`](/hooks/use-column-resize). The column needs `position: relative` and draws its own border.

```tsx
import { ColumnResizeHandle, useColumnResize } from '@basmilius/desktop-ui';
```

<Demo src="layout/column-resize-handle" fill />

`from` is the edge the column hangs from, the same value you hand the hook; the handle sits on the opposite edge. A column pinned to the left gets its handle on the right, and the cursor says which way it drags.

## Props

| Prop | Type | |
| --- | --- | --- |
| `from` | `ColumnEdge` | Required. `'left' \| 'right' \| 'top' \| 'bottom'` |
| `onPointerDown` | `(event: PointerEvent) => void` | Required. `startResize` from the hook. |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

The handle takes the pointer only; give a column a keyboard way to change its size elsewhere, such as a menu item or a setting, if that matters in your app. `ColumnResizeHandleProps` is an exported type.
