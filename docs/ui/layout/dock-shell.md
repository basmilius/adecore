# DockShell

The floating bar at the bottom of a canvas-like view, which can hide itself.

```tsx
import { DockShell } from '@adecore/ui';
```

<Demo src="layout/dock-shell" fill />

With `autoHide` the dock hides below the edge until the pointer comes within 120 pixels of the window's bottom. An open menu in the dock keeps it up. Keyboard focus inside it brings it back.

Mark an element that belongs to the dock, such as a popover on it, with `data-holds-dock`, so hovering it keeps the dock up. `onHiddenChange` reports when the bar hides or returns.

The dock is centered 16 pixels above the bottom of its positioned parent. The bar is a [`Surface`](/ui/display/surface).

## Props

`DockShell` renders a `<div>` and takes its props, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. |
| `autoHide` | `boolean` | `false` | |
| `barClassName` | `string` | | Classes for the bar itself, such as letting a dock with many buttons wrap. |
| `onHiddenChange` | `(hidden: boolean) => void` | | |
| `ref` | `Ref<HTMLDivElement>` | | The outer box, not the bar. |

`DockShellProps` is an exported type.
