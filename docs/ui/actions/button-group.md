# ButtonGroup

Icon buttons that belong together, 1 pixel apart. Separate groups keep the wider gap of the row they stand in, so a toolbar reads as clusters rather than a fence of equal buttons.

```tsx
import { ButtonGroup } from '@adecore/ui';
```

<Demo src="actions/button-group" />

A group draws no border and no background. Give it `role="group"` and an `aria-label` when the buttons share a purpose a screen reader should hear, as the alignment buttons above do. [`Stepper`](/ui/inputs/stepper) and [`ZoomControls`](/ui/layout/zoom-controls) are button groups on a sunken track.

## Props

`ButtonGroup` renders a `<div>` and takes its props, plus `render`. `ButtonGroupProps` is an exported type.
