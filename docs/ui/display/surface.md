# Surface

The glass card that floats over the content under it: a dock, a banner, a toast, a find bar. It brings the translucent, blurred ground, the border and the floating shadow. You bring the shape (radius, padding, height) and the position.

```tsx
import { Surface } from '@adecore/ui';
```

<Demo src="display/surface" />

[`Banner`](/ui/display/banner), [`DockShell`](/ui/layout/dock-shell) and [`Toasts`](/ui/overlays/toasts) are drawn on it. For a card that sits in the layout rather than over it, use `bg-surface` and a border.

`Surface` takes the props of a `<div>`, plus `render`. `SurfaceProps` is an exported type.

## A colored ground

On a ground of a color of its own, such as a header a person colored, the hover of a button and a separator stay gray unless they are told. `tintStyle(color, ground?)` gives the element its custom properties, so every `IconButton`, ghost `Button` and `Separator` inside takes a shade of that color. `ground` is what the color is mixed into for the hover, `var(--surface-raised)` by default.

```tsx
<header style={{ backgroundColor: headerColor, ...tintStyle(accent) }}>
```
