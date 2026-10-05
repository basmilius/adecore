# Checkbox

Picked or not: one item out of a list, or an option that waits for a Save button. A setting that takes effect the moment it flips is a [`Switch`](/ui/inputs/switch).

```tsx
import { Checkbox } from '@adecore/ui';
```

<Demo src="inputs/checkbox" />

`label` is the accessible name. Put the box and its visible text in one `<label>`, so a press on the text picks it too. Space toggles it from the keyboard.

A box that picks every row of a list is `indeterminate` while some rows are picked and some are not, and draws a dash. A press still reports the opposite of `checked`, so with `checked={false}` it picks every row. Which rows it stands for is yours to keep.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `checked` | `boolean` | | Required. |
| `onCheckedChange` | `(checked: boolean) => void` | | Required. |
| `label` | `string` | | Required. |
| `indeterminate` | `boolean` | `false` | Draws a dash. |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | |

`CheckboxProps` is an exported type.
