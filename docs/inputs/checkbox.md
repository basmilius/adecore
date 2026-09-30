# Checkbox

Picked or not: one item out of a list, or an option that waits for a Save button. A setting that takes effect the moment it flips is a [`Switch`](/inputs/switch).

```tsx
import { Checkbox } from '@basmilius/desktop-ui';
```

<Demo src="inputs/checkbox" />

A checkbox has a `label` for its accessible name. Put the box and its visible text in one `<label>`, so a press on the text picks it too. Space toggles it from the keyboard.

A box that picks every row of a list is `indeterminate` while some rows are picked and some are not. It draws a dash, and a press picks every row; which rows it stands for is yours to keep.

## Props

| Prop | Type | |
| --- | --- | --- |
| `checked` | `boolean` | Required. |
| `onCheckedChange` | `(checked: boolean) => void` | Required. |
| `label` | `string` | Required. |
| `indeterminate` | `boolean` | Draws a dash. `false` by default. |
| `disabled` | `boolean` | |
| `className` | `string` | |
| `ref` | `Ref<HTMLButtonElement>` | |

`CheckboxProps` is an exported type.
