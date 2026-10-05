# Switch

On or off, for a setting that takes effect the moment it flips. A change that waits for a Save button is a [`Checkbox`](/ui/inputs/checkbox).

```tsx
import { Switch } from '@adecore/ui';
```

<Demo src="inputs/switch" />

`label` is the accessible name. The row it sits in usually carries the visible one, as a [`SettingsRow`](/ui/settings/settings-section) does. Space toggles it from the keyboard.

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
