# Input and TextArea

The one text input: one border and one focus outline, at the normal height of 32 pixels or the compact 28. `TextArea` is a field of a few lines, such as a commit message or a note.

```tsx
import { Input, TextArea } from '@basmilius/react-ui';
```

<Demo src="inputs/input" />

`size="sm"` is the height of a small button, for a row of tools or a name typed in place of the label it renames. `mono` switches to the code face for a branch, a path or anything read back character by character.

A `TextArea` is at least 64 pixels tall; `rows` makes it taller. It takes the same `size`: the body text of an input by default, and with `size="sm"` the smaller text and padding of a compact input, for a commit message in a narrow panel. It has no resize handle until `resize="vertical"` gives it one, for a draft of a few sentences that a person may want to see whole.

Inside a [`Field`](/inputs/field) both take their `id`, `aria-describedby` and `aria-invalid` from it. Outside one, give them an `aria-label`.

## Props

`Input` takes every prop of an `<input>` except its numeric `size`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `mono` | `boolean` | `false` | |

`TextArea` takes every prop of a `<textarea>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `resize` | `'none' \| 'vertical'` | `'none'` | `'vertical'` adds a handle to drag it taller. |

`InputProps` and `TextAreaProps` are exported types.
