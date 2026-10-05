# Input and TextArea

The one text input: one border and one focus outline, at the normal height of 32 pixels or the compact 28. `TextArea` is a field of a few lines, such as a commit message or a note.

```tsx
import { Input, TextArea } from '@adecore/ui';
```

<Demo src="inputs/input" />

`size="sm"` is the height of a small button, for a row of tools or a name typed in place of the label it renames. `mono` switches to the code face for a branch, a path or anything read back character by character.

`icon` draws a Lucide icon in front of the text, such as a magnifier on a search field. The icon is 14 pixels, or 12 with `size="sm"`. The input then sits in a box that draws the field, and `className` goes to that box so it lays out like any other field; `ref` and every other prop stay on the input.

A value a person reads but does not type, such as a chosen folder beside the button that picks it, is an `Input` with `readOnly`. It shows the value in the muted text color and ends a long one with an ellipsis. It stays an input, so a screen reader announces it as read-only and the value can be copied.

<Demo src="inputs/input-icon" />

A `TextArea` is at least 64 pixels tall; `rows` makes it taller. `size="sm"` gives it the smaller text and padding of a compact input, for a commit message in a narrow panel. It has no resize handle until `resize="vertical"` gives it one.

Inside a [`Field`](/ui/inputs/field) both take their `id`, `aria-describedby` and `aria-invalid` from it. Outside one, give them an `aria-label`.

## Props

`Input` takes every prop of an `<input>` except its numeric `size`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `mono` | `boolean` | `false` | |
| `icon` | `LucideIcon` | | Drawn in front of the text. |

`TextArea` takes every prop of a `<textarea>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `resize` | `'none' \| 'vertical'` | `'none'` | `'vertical'` adds a handle to drag it taller. |
| `mono` | `boolean` | `false` | The code face, as on an `Input`. |

`InputProps` and `TextAreaProps` are exported types.
