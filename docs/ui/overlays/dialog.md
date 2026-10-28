# Dialog

A modal dialog for a question or a short form, as a compound component on Base UI's dialog. For one question with a typed answer, use [`PromptDialog`](/ui/overlays/prompt-dialog).

```tsx
import { Dialog } from '@adecore/ui';
```

<Demo src="overlays/dialog" />

## Parts

| Part | What it is |
| --- | --- |
| `Dialog.Root` | Holds the open state: `open` and `onOpenChange`, or `defaultOpen`. |
| `Dialog.Trigger` | The button that opens it. |
| `Dialog.Popup` | The portal, the backdrop and the popup in one part. |
| `Dialog.Title` | The heading and accessible name. `size="lg"` for a header rather than a question. |
| `Dialog.Description` | The sentence under the title, read as the dialog's description. No margin. |
| `Dialog.Text` | Another line in the description's style, such as a warning. |
| `Dialog.Footer` | The buttons, main action last (on the right). |
| `Dialog.Close` | A button that closes the dialog. Pass a `Button` through `render`. |

## Size

`size="sm"` is 420 pixels wide with 20 pixels of padding, for question dialogs. Without a size, `className` sets the width and there is no padding.

## A dialog over a dialog

A dialog opened over another stacks over it and dims it. `nested` forces that layering for a dialog that always opens over another. Menus and selects in either dialog float above both.

<Demo src="overlays/dialog-nested" />

## Popup props

`Dialog.Popup` takes Base UI's popup props, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'sm'` | | |
| `nested` | `boolean` | `false` | Always over another dialog. |
| `backdrop` | `boolean` | `true` | The dim behind the dialog. |
| `backdropClassName` | `string` | | Such as `lightbox-backdrop`, a heavier dim for a picture. |
| `keepMounted` | `boolean` | | Keeps the popup mounted while closed. |

`Dialog.Title` takes `size` `'base'` (the default) or `'lg'`. `Dialog.Description` and `Dialog.Text` take `size` `'sm'` (the default) or `'xs'`. `Dialog.Text` and `Dialog.Footer` take `render`.

## Keyboard and focus

Focus moves into the dialog and Tab stays inside. Escape and a backdrop click call `onOpenChange(false)`. Closing returns focus to the trigger.

## Types

`DialogPopupProps`, `DialogTitleProps`, `DialogDescriptionProps`, `DialogTextProps` and `DialogFooterProps` are exported types.
