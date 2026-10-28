# PromptDialog

A dialog that asks one question: a name to type, or a warning to accept. Use it for every confirm and rename.

```tsx
import { PromptDialog } from '@adecore/ui';
```

<Demo src="overlays/prompt-dialog" />

Try `HEAD` as the name to see a failure. While a promise from `onConfirm` runs, the confirm button is disabled. A rejection shows its message and the dialog stays open; the message is the error's, or `fallbackMessage` for a non-`Error` ([`messageOf`](/ui/utilities/error-messages)). The confirm button is also disabled while the field is empty, unless `allowEmpty` is set.

## It never closes itself

`onOpenChange(false)` fires only on Cancel, Escape or a click outside. After a confirm, you close the dialog, so a follow-up question can reuse it.

The fields reset to `field.initial` and `area.initial` each time `open` turns true.

## A confirm

Without `field` the dialog is a plain confirm. `danger` turns the confirm button red. [`ConfirmDialog`](/ui/settings/confirm-dialog) wraps this for a destructive step over another dialog.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `open` | `boolean` | | Required. |
| `onOpenChange` | `(open: boolean) => void` | | Required. |
| `title` | `string` | | Required. |
| `confirmLabel` | `string` | | Required. |
| `onConfirm` | `(value: string, body: string) => void \| Promise<unknown>` | | Required. Told the trimmed field and area. |
| `titleIcon` | `LucideIcon` | | |
| `description` | `ReactNode` | | |
| `field` | `{ label?, ariaLabel?, initial?, placeholder?, mono?, maxLength? }` | | A one-line field. Enter confirms. |
| `area` | `{ label, initial?, placeholder? }` | | A taller field under it. |
| `confirmBusyLabel` | `string` | | What the button says while the step runs. |
| `confirmIcon` | `LucideIcon` | | |
| `danger` | `boolean` | `false` | |
| `busy` | `boolean` | `false` | For a step the caller runs elsewhere. |
| `allowEmpty` | `boolean` | `false` | Lets the field be confirmed empty. |
| `confirmDisabled` | `boolean` | `false` | Disables the confirm for another reason than an empty field. |
| `secondary` | `{ label, onClick }` | | A second way out next to the confirm. |
| `nested` | `boolean` | `false` | Over another dialog. |
| `children` | `ReactNode` | | Anything between the description and the buttons. |
| `fallbackMessage` | `string` | | The failure line when a rejection is not an `Error`. |
| `className` | `string` | | On the popup. |
| `ref` | `Ref<HTMLDivElement>` | | |

`PromptDialogProps` is an exported type.
