# Pill

The small label in a header, a sidebar row or a settings line: a count, a branch, a status. With an `onClick` it is a button, and with `pressed` a toggle.

```tsx
import { Pill } from '@adecore/ui';
```

<Demo src="actions/pill" />

The tone says what the label means about the thing it names. `muted` is the default, and `raised` lifts a label off a sunken header so it reads as a control. `idle`, `needsYou` and `error` use the status colors. A `tag` is tighter and heavier than a `pill`, for the end of a line of prose. `mono` suits a branch name or a count that is read character by character.

Every ground is an alpha of the text color, or of the status or accent color, over whatever the pill stands on. In the dark theme a pill lifts a shade off its row, in the light theme it sinks one, so it reads on a sidebar row, a header and a card alike. The text is 12px on a 19px line, and a pill never breaks inside itself: in a row that wraps it moves to the next line whole.

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
