# Switch

On or off, for a setting that applies at once. For a change that waits for Save, use a [`Checkbox`](/ui/inputs/checkbox).

```tsx
import { Switch } from '@adecore/ui';
```

<Demo src="inputs/switch" />

`label` is the accessible name; the visible one usually comes from the row, such as a [`SettingsRow`](/ui/settings/settings-section). Space toggles it.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `checked` | `boolean` | | Required. |
| `onCheckedChange` | `(checked: boolean) => void` | | Required. |
| `label` | `string` | | Required. |
| `disabled` | `boolean` | | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLButtonElement>` | | |

`SwitchProps` is an exported type.
