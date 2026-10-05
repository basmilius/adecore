# PromptDialog

The one dialog a question is asked in: a name to type, or a warning to agree with. Every confirm and every rename can share it instead of growing a layout of its own.

```tsx
import { PromptDialog } from '@adecore/ui';
```

<Demo src="overlays/prompt-dialog" />

Try `HEAD` as the name to see a failure. When `onConfirm` returns a promise, the confirm button is disabled while it runs, and a rejection stays on screen as the reason while the dialog stays open. The message is the error's, or `fallbackMessage` when the rejection is not an `Error` ([`messageOf`](/ui/utilities/error-messages)). The confirm button also waits while the field is empty, unless `allowEmpty` is set.

## It never closes itself

`onOpenChange` is only ever told `false`, by Cancel, Escape or a click outside. After a confirm the dialog stays open until you close it, since a step that asks a second question would lose the dialog if it closed on its own.

Every opening starts from the props. The fields reset to `field.initial` and `area.initial` each time `open` turns true, so one mounted dialog can ask about one branch and then another.

## A confirm

Without `field` the dialog is a confirm and nothing else. `danger` turns the confirm button red. [`ConfirmDialog`](/ui/settings/confirm-dialog) wraps this for a destructive step over another dialog.

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
| `confirmDisabled` | `boolean` | `false` | A reason the question cannot be answered, beside an empty field. |
| `secondary` | `{ label, onClick }` | | A second way out next to the confirm. |
| `nested` | `boolean` | `false` | Over another dialog. |
| `children` | `ReactNode` | | Anything between the description and the buttons. |
| `fallbackMessage` | `string` | | The failure line when a rejection is not an `Error`. |
| `className` | `string` | | On the popup. |
| `ref` | `Ref<HTMLDivElement>` | | |

`PromptDialogProps` is an exported type.
