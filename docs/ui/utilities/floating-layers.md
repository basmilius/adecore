# Floating layers

Every popup, menu, tooltip and dialog of the library is portaled to `<body>`, but its React events still bubble through the tree it was declared in. A canvas that handles pointer events has to tell the two apart.

```tsx
import { cameThroughPortal, isInFloatingLayer } from '@adecore/ui';
```

<Demo src="utilities/floating-layers" />

`isInFloatingLayer(target)` says whether an event's target lies in a popup, tooltip or dialog of the library.

`cameThroughPortal(event)` says whether an event reached `currentTarget` through a portal. Use it for a handler that should only hear events from its own DOM.
