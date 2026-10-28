# PreviewCard

A card that opens on hover over its trigger, usually a link, drawn like a [popover](/ui/overlays/popover), to preview the link's target.

```tsx
import { PreviewCard } from '@adecore/ui';
```

<Demo src="overlays/preview-card" />

## Parts

| Part | What it is |
| --- | --- |
| `PreviewCard.Root` | Holds the open state, and the delays before it opens and closes. |
| `PreviewCard.Trigger` | The link the card belongs to. It renders an `<a>`. |
| `PreviewCard.Popup` | Portal, positioner and card, with the `variant` and placement props of `Popover.Popup`. |

The card opens only for the pointer, so keep anything a person needs on the page or behind the link.

`PreviewCardPopupProps` is an exported type.
