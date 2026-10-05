# Surface

The glass card that floats over the content under it: a dock, a banner, a toast, a find bar. It brings the translucent ground, the border and the floating shadow. You bring the shape (radius, padding, height) and the position.

```tsx
import { Surface } from '@adecore/ui';
```

<Demo src="display/surface" />

[`Banner`](/ui/display/banner), [`DockShell`](/ui/layout/dock-shell) and [`Toasts`](/ui/overlays/toasts) are drawn on it. For a card that sits in the layout rather than over it, use `bg-surface` and a border.

`Surface` takes the props of a `<div>`, `className`, `ref` and `render`. `SurfaceProps` is an exported type.
