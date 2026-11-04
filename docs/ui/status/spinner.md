# Spinner

Work in progress: three dots that leap over each other. It takes the color of the text around it, and with reduced motion the dots stand still in a row.

```tsx
import { Spinner } from '@adecore/ui';
```

<Demo src="display/spinner" />

It comes in the sizes of an [`Icon`](/ui/display/icon), 12, 14, 16 and 20 pixels.

Without a `label` it is hidden from screen readers, for a spinner next to words that say what runs. Give it a `label` when it stands on its own.

```tsx
<Tooltip label="Running">
    <Spinner size={12} label="Running" className="text-accent" />
</Tooltip>
```

Every spinner under a `UIProvider` steps on the document's clock, so spinners that mount at different moments move together and the window draws one frame for a step of all of them. An app puts its own looping CSS animations on that clock by their `@keyframes` name. Only an animation that loops and never restarts on purpose belongs there: a one-off animation would start long over.

```tsx
import { syncAnimations } from '@adecore/ui';

syncAnimations(['status-pulse']);
```

An [`IconButton`](/ui/actions/icon-button), an [`EmptyState`](/ui/status/empty-state) and a [`PanelEmpty`](/ui/status/panel-empty) draw one in place of their icon with `busy`.

## Props

`Spinner` takes every prop of a `<span>` except `children`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` | `16` | In pixels: 12, 14, 16 or 20. |
| `label` | `string` | | The name a screen reader reads. Without it the spinner is hidden. |

`SpinnerProps` is an exported type.
