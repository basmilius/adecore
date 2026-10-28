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

An [`IconButton`](/ui/actions/icon-button), an [`EmptyState`](/ui/display/empty-state) and a [`PanelEmpty`](/ui/display/panel-empty) draw one in place of their icon with `busy`.

## Props

`Spinner` takes every prop of a `<span>` except `children`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` | `16` | In pixels: 12, 14, 16 or 20. |
| `label` | `string` | | The name a screen reader reads. Without it the spinner is hidden. |

`SpinnerProps` is an exported type.
