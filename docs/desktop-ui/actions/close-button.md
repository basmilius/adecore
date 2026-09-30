# CloseButton

The close button in the header of a panel or a dialog, an [`IconButton`](/desktop-ui/actions/icon-button) with an X. It closes in one of two ways, and you pick one.

```tsx
import { CloseButton } from '@basmilius/desktop-ui';
```

<Demo src="actions/close-button" />

With `onClick` it calls your handler, for a panel whose open state you keep. With `dialog` it is the dialog's own `Dialog.Close` part, so it closes whichever dialog it sits in without a handler.

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
