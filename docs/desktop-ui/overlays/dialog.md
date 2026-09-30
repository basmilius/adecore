# Dialog

A modal dialog, as a compound component on Base UI's dialog. It is for a question or a form of a few fields. For a single question with an answer typed in, use [`PromptDialog`](/desktop-ui/overlays/prompt-dialog), which already has the layout.

```tsx
import { Dialog } from '@basmilius/desktop-ui';
```

<Demo src="overlays/dialog" />

## Parts

| Part | What it is |
| --- | --- |
| `Dialog.Root` | Holds the open state: `open` and `onOpenChange`, or `defaultOpen`. |
| `Dialog.Trigger` | The button that opens it. |
| `Dialog.Popup` | The portal, the backdrop and the popup in one part. |
| `Dialog.Title` | The heading, which is also the dialog's accessible name. `size="lg"` for a dialog with a header of its own rather than a question. |
| `Dialog.Description` | The sentence under the title, which a screen reader reads as the dialog's description. It carries no margin. |
| `Dialog.Text` | A further line in the description's style that is not the description: a warning, a note under a choice. |
| `Dialog.Footer` | The buttons at the foot, with the main action last and so on the right. |
| `Dialog.Close` | A button that closes the dialog. Hand it a `Button` through `render`. |

## Size

`size="sm"` is 420 pixels wide with 20 pixels of padding, the one width every question dialog shares. Without a size the popup is as wide as its `className` says, and brings no padding.

## A dialog over a dialog

A dialog that opens while another is up stacks over it by itself. Its backdrop dims the first dialog too, and the first one stops taking clicks. `nested` forces the stacked layers for a dialog that always opens over another. Menus and selects inside either dialog still float above both.

<Demo src="overlays/dialog-nested" />

## Popup props

`Dialog.Popup` takes Base UI's popup props, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'sm'` | | |
| `nested` | `boolean` | `false` | Always over another dialog. |
| `backdrop` | `boolean` | `true` | The dim behind the dialog. |
| `backdropClassName` | `string` | | Such as `lightbox-backdrop`, the heavier dim a picture needs. |
| `keepMounted` | `boolean` | | Keeps the popup in the document while it is closed. |

`Dialog.Title` and `Dialog.Description` take a `size`, and `Dialog.Text` and `Dialog.Footer` take `render`.

## Keyboard and focus

Opening the dialog moves focus into it, and Tab stays inside until it closes. Escape and a click on the backdrop close it through `onOpenChange(false)`. Closing returns focus to the trigger.

## Types

`DialogPopupProps`, `DialogTitleProps`, `DialogDescriptionProps`, `DialogTextProps` and `DialogFooterProps` are exported types.
