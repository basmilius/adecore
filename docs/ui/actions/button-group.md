# ButtonGroup

Icon buttons that belong together, set 1 pixel apart so a toolbar shows them as one cluster.

```tsx
import { ButtonGroup } from '@adecore/ui';
```

<Demo src="actions/button-group" />

A group draws no border or background. Give it `role="group"` and an `aria-label` when the buttons share a purpose. [`Stepper`](/ui/inputs/stepper) and [`ZoomControls`](/ui/layout/zoom-controls) are button groups on a sunken track.

## Props

`ButtonGroup` renders a `<div>` and takes its props, plus `render`. `ButtonGroupProps` is an exported type.
