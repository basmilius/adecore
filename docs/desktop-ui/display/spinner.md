# Spinner

Work in progress: three dots that leap over each other. It takes the color of the text around it, and with reduced motion the dots stand still in a row.

```tsx
import { Spinner } from '@basmilius/desktop-ui';
```

<Demo src="display/spinner" />

It comes in the sizes of an [`Icon`](/desktop-ui/display/icon): 12, 14, 16 and 20 pixels, and is centered on the text beside it the same way.

Without a `label` it is hidden from screen readers, like an icon, for a spinner next to words that already say what runs. Give it a `label` when it stands on its own, such as a mark beside a title. It takes a [`Tooltip`](/desktop-ui/overlays/tooltip) like any other element.

```tsx
<Tooltip label="Running">
    <Spinner size={12} label="Running" className="text-accent" />
</Tooltip>
```

An [`IconButton`](/desktop-ui/actions/icon-button), an [`EmptyState`](/desktop-ui/display/empty-state) and a [`PanelEmpty`](/desktop-ui/display/panel-empty) draw one in place of their icon with `busy`.

## Props

`Spinner` takes every prop of a `<span>` except `children`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `number` | `16` | In pixels: 12, 14, 16 or 20. |
| `label` | `string` | | The name a screen reader reads. Without it the spinner is hidden. |

`SpinnerProps` is an exported type.
