# Surface

The glass card that floats over content: a dock, a banner, a toast, a find bar. It brings the blurred ground, the border and the shadow. You bring the radius, padding, height and position.

```tsx
import { Surface } from '@adecore/ui';
```

<Demo src="display/surface" />

[`Banner`](/ui/display/banner), [`DockShell`](/ui/layout/dock-shell) and [`Toasts`](/ui/overlays/toasts) are drawn on it. For a card that sits in the layout rather than over it, use `bg-surface` and a border.

`Surface` takes the props of a `<div>`, plus `render`. `SurfaceProps` is an exported type.

## A colored ground

On a colored ground, such as a header a person colored, button hovers and separators stay gray by default. `tintStyle(color, ground?)` returns custom properties that give every `IconButton`, ghost `Button` and `Separator` inside a shade of that color. `ground` is what the color is mixed into for the hover, `var(--surface-raised)` by default.

```tsx
<header style={{ backgroundColor: headerColor, ...tintStyle(accent) }}>
```
