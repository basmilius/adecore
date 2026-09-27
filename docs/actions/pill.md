# Pill

The small rounded label in a header, a sidebar row or a settings line: a count, a branch, a status. With an `onClick` it is a button, and with `pressed` a toggle.

```tsx
import { Pill } from '@basmilius/react-ui';
```

<Demo src="actions/pill" />

The tone says what the label means about the thing it names. `muted` is the default, and `raised` lifts a label off a sunken header so it reads as a control. `idle`, `needsYou` and `error` use the status colors. A `tag` is tighter and bolder than a `pill`, for the end of a line of prose. `mono` suits a branch name or a count that is read character by character.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. |
| `icon` | `ReactNode` | | Drawn before the text; use a 12 pixel `Icon`. |
| `tone` | `'muted' \| 'raised' \| 'idle' \| 'needsYou' \| 'error' \| 'accent'` | `'muted'` | |
| `shape` | `'pill' \| 'tag'` | `'pill'` | |
| `mono` | `boolean` | `false` | |
| `onClick` | `() => void` | | Makes the pill a button. |
| `pressed` | `boolean` | | Makes the button a toggle (`aria-pressed`). |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLElement>` | | A `<span>`, or a `<button>` with `onClick`. |

`PillProps` is an exported type.
