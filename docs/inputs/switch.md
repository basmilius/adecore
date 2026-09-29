# Switch

On or off, as a switch rather than a checkbox, for a setting that takes effect the moment it flips. A change that waits for a Save button is a [`Checkbox`](/inputs/checkbox)'s job.

```tsx
import { Switch } from '@basmilius/react-ui';
```

<Demo src="inputs/switch" />

A switch has a `label` for its accessible name. The row it sits in usually carries the visible one, as a [`SettingsRow`](/settings/settings-section) does. Space toggles it from the keyboard.

## Props

| Prop | Type | |
| --- | --- | --- |
| `checked` | `boolean` | Required. |
| `onCheckedChange` | `(checked: boolean) => void` | Required. |
| `label` | `string` | Required. |
| `disabled` | `boolean` | |
| `className` | `string` | |
| `ref` | `Ref<HTMLButtonElement>` | |

`SwitchProps` is an exported type.
