# Checkbox

Picked or not: an item in a list, or an option that waits for Save. For a setting that applies at once, use a [`Switch`](/ui/inputs/switch).

```tsx
import { Checkbox } from '@adecore/ui';
```

<Demo src="inputs/checkbox" />

`label` is the accessible name. Wrap the box and its visible text in one `<label>` so the text toggles it too. Space toggles it.

`indeterminate` draws a dash, for a select-all box while some rows are picked. A press still reports the opposite of `checked`, so with `checked={false}` it picks every row.

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
