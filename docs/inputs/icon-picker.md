# IconPicker

The mark a thing wears, picked from a set of Lucide icons, as a grid under a label. Every icon's name is its tooltip and its accessible name.

```tsx
import { IconPicker } from '@basmilius/react-ui';
```

<Demo src="inputs/icon-picker" />

With `onClear`, a button beside the label clears the icon. Leave it out when the thing falls back to a default icon of its own. The label defaults to the library's "Icon"; give it another name when the same surface also takes a picture, or the two read as one list.

## Props

| Prop | Type | |
| --- | --- | --- |
| `icons` | `Readonly<Record<string, LucideIcon>>` | Required. Every icon by its name, in the order of the grid. |
| `value` | `string \| null` | Required. The name of the picked icon. |
| `onValueChange` | `(name: string) => void` | Required. |
| `onClear` | `() => void` | |
| `label` | `string` | |
| `disabled` | `boolean` | |
| `className` | `string` | |
| `ref` | `Ref<HTMLDivElement>` | |

`IconPickerProps` is an exported type.
