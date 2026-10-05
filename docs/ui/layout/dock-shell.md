# DockShell

The floating bar at the bottom of a canvas-like view, and the one place that knows how to get out of the way.

```tsx
import { DockShell } from '@adecore/ui';
```

<Demo src="layout/dock-shell" fill />

With `autoHide` the dock waits below the edge until the pointer comes within 120 pixels of the bottom of the window. An open menu in the dock keeps it up, since the menu's popup would slide away with it. The buttons stay in the tab order while the dock is out of sight, and keyboard focus inside it brings it back.

Something that moves with the dock, such as a popover standing on it, marks itself with `data-holds-dock`, so reaching for it does not hide the dock under the pointer. `onHiddenChange` tells you whenever the bar slides away or comes back, for anything that stands on top of it.

The dock is centered 16 pixels above the bottom of its positioned parent, and the bar is a [`Surface`](/ui/display/surface).

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
