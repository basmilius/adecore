# CloseButton

The close button in the header of a panel or a dialog, an [`IconButton`](/ui/actions/icon-button) with an X.

```tsx
import { CloseButton } from '@adecore/ui';
```

<Demo src="actions/close-button" />

Pass either `onClick`, for a panel whose state you hold, or `dialog`, to close the dialog it sits in.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` | | Required. The accessible name and tooltip, such as "Close settings". |
| `onClick` | `() => void` | | Either this |
| `dialog` | `true` | | or this. |
| `kbd` | `Shortcut \| string` | | The key that closes, printed in the tooltip. |
| `size` | `IconButtonSize` | `'md'` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | |

`CloseButtonProps` is an exported type.
