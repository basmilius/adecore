# Pill

The small label in a header, a sidebar row or a settings line: a count, a branch, a status. With `onClick` it is a button, and with `pressed` a toggle.

```tsx
import { Pill } from '@adecore/ui';
```

<Demo src="actions/pill" />

`muted` is the default tone. `raised` lifts a label off a sunken header so it reads as a control. `idle`, `needsYou` and `error` use the status colors, `accent` the app's accent. A `tag` is tighter and heavier than a `pill`, for the end of a line of prose. `size="sm"` trims the padding for dense rows. `mono` suits a branch name.

The ground is an alpha of the tone, so a pill reads on any surface. A pill never wraps inside itself.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. |
| `icon` | `ReactNode` | | Drawn before the text; use a 12 pixel `Icon`. |
| `tone` | `'muted' \| 'raised' \| 'idle' \| 'needsYou' \| 'error' \| 'accent'` | `'muted'` | |
| `shape` | `'pill' \| 'tag'` | `'pill'` | |
| `size` | `'md' \| 'sm'` | `'md'` | `'sm'` is 20 pixels tall instead of 24. |
| `mono` | `boolean` | `false` | |
| `onClick` | `() => void` | | Makes the pill a button. |
| `pressed` | `boolean` | | Makes the button a toggle (`aria-pressed`). |
| `disabled` | `boolean` | | Only with `onClick`. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLElement>` | | A `<span>`, or a `<button>` with `onClick`. |

`PillProps` is an exported type.
