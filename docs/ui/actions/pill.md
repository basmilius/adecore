# Pill

The small label in a header, a sidebar row or a settings line: a count, a branch, a status. With `onClick` it is a button, and with `pressed` a toggle.

```tsx
import { Pill } from '@adecore/ui';
```

<Demo src="actions/pill" />

The tone says what the label means. `muted` is the default, and `raised` lifts a label off a sunken header so it reads as a control. `idle`, `needsYou` and `error` use the status colors, `accent` the app's accent. A `tag` is tighter and heavier than a `pill`, for the end of a line of prose. `mono` suits a branch name or a count read character by character.

Every ground is an alpha of the tone's color over whatever the pill stands on, so the same pill reads on a sidebar row, a header and a card. The text is the theme's `2xs` size, and a pill never wraps inside itself: in a row that wraps it moves to the next line whole.

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
| `disabled` | `boolean` | | Only with `onClick`. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLElement>` | | A `<span>`, or a `<button>` with `onClick`. |

`PillProps` is an exported type.
