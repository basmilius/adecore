# Input and TextArea

The text input, 32 pixels high or 28 with `size="sm"`. `TextArea` is a field of a few lines, such as a commit message.

```tsx
import { Input, TextArea } from '@adecore/ui';
```

<Demo src="inputs/input" />

`size="sm"` matches a small button, for a toolbar or an inline rename. `mono` uses the code font, for a branch or a path.

`icon` draws a Lucide icon before the text, 14 pixels or 12 with `size="sm"`. The input then sits in a box that draws the field. `className` goes to that box; `ref` and the other props stay on the input.

For a value a person reads but does not type, such as a chosen folder, use `readOnly`. The value is muted and truncates, and stays copyable.

<Demo src="inputs/input-icon" />

`end` draws content after the text, such as a match count and an `xs` [`IconButton`](/ui/actions/icon-button) that clears the query. Like `icon`, it wraps the input in a box that takes `className`. Keep `end` set while the field is on screen (`false` when empty), or the input remounts and loses focus.

<Demo src="inputs/input-end" />

A `TextArea` is at least 64 pixels tall; `rows` makes it taller. `size="sm"` gives it compact text and padding. `resize="vertical"` adds a resize handle.

`variant="bare"` drops the border, ground and focus outline, for a text area inside a card that draws them. The card then shows focus itself, for example with `has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:-outline-offset-1 has-[textarea:focus-visible]:outline-accent`.

<Demo src="inputs/text-area-bare" />

Inside a [`Field`](/ui/inputs/field) both take their `id`, `aria-describedby` and `aria-invalid` from it. Outside one, give them an `aria-label`.

## Props

`Input` takes every prop of an `<input>` except its numeric `size`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `mono` | `boolean` | `false` | |
| `icon` | `LucideIcon` | | Drawn in front of the text. |
| `end` | `ReactNode` | | Drawn after the text, inside the field. |

`TextArea` takes every prop of a `<textarea>`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `size` | `'md' \| 'sm'` | `'md'` | |
| `resize` | `'none' \| 'vertical'` | `'none'` | |
| `mono` | `boolean` | `false` | |
| `variant` | `'field' \| 'bare'` | `'field'` | |

`InputProps` and `TextAreaProps` are exported types.
