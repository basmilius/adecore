# ConfirmDialog

Confirms one destructive step over the dialog it opens from. It is a nested [`PromptDialog`](/ui/overlays/prompt-dialog) with a danger button that closes itself once the step succeeds.

```tsx
import { ConfirmDialog } from '@adecore/ui/settings';
```

<Demo src="settings/confirm-dialog" />

While the promise from `onConfirm` runs, the button is disabled. On resolve the dialog closes; on reject it stays open and shows the reason.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | | Required. |
| `onOpenChange` | `(open: boolean) => void` | | Required. |
| `title` | `string` | | Required. |
| `description` | `string` | | Required. |
| `confirmLabel` | `string` | | Required. |
| `onConfirm` | `() => Promise<void>` | | Required. |
| `className` | `string` | | On the popup. |
| `ref` | `Ref<HTMLDivElement>` | | On the popup. |

`ConfirmDialogProps` is an exported type.
