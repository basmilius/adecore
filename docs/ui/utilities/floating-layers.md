# Floating layers

Every popup, menu, tooltip and dialog of the library is portaled out to `<body>`. Its DOM is elsewhere, but its React events still bubble through the tree it was declared in. A canvas that treats a pointer event as its own needs to tell the two apart.

```tsx
import { cameThroughPortal, isInFloatingLayer } from '@adecore/ui';
```

<Demo src="utilities/floating-layers" />

`isInFloatingLayer(target)` says whether an event's target lies in a popup, a tooltip or a dialog of the library, rather than on the surface under it. Clicking the menu row above does not count as a click on the canvas.

`cameThroughPortal(event)` says whether an event reached `currentTarget` through a portal, with its target inside the element in React's tree but not in the DOM. Use it for a handler that should only hear events from its own DOM.
