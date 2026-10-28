# ColumnResizeHandle

An invisible strip on the free edge of a column or row that starts a drag from [`useColumnResize`](/ui/hooks/use-column-resize). The column needs `position: relative` and draws its own border.

```tsx
import { ColumnResizeHandle, useColumnResize } from '@adecore/ui';
```

<Demo src="layout/column-resize-handle" fill />

`from` is the edge the column hangs from, as passed to the hook. The handle is an 8 pixel strip on the opposite edge. It is pointer only, so offer keyboard users another way, such as a setting.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `from` | `ColumnEdge` | | Required. `'left' \| 'right' \| 'top' \| 'bottom'` |
| `onPointerDown` | `(event: PointerEvent) => void` | | Required. `startResize` from the hook. |
| `className` | `string` | | |
| `style` | `CSSProperties` | | Inline dimensions or placement, such as a wider gap. |
| `ref` | `Ref<HTMLDivElement>` | | |

`ColumnResizeHandleProps` is an exported type.
