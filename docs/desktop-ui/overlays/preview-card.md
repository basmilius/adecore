# PreviewCard

A card that opens while the pointer rests on its trigger, usually a link, drawn like a [popover](/desktop-ui/overlays/popover). It previews what the link leads to without leaving the page.

```tsx
import { PreviewCard } from '@basmilius/desktop-ui';
```

<Demo src="overlays/preview-card" />

## Parts

| Part | What it is |
| --- | --- |
| `PreviewCard.Root` | Holds the open state, and the delays before it opens and closes. |
| `PreviewCard.Trigger` | The link the card belongs to. It renders an `<a>`. |
| `PreviewCard.Popup` | The portal, the positioner and the card, with the same `variant` and placement props as `Popover.Popup`. |

Treat the card as extra. It opens for the pointer, so keep anything a person needs on the page or behind the link itself.

`PreviewCardPopupProps` is an exported type.
