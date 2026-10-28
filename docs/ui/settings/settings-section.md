# SettingsSection and SettingsRow

The parts a settings pane is built from. A `SettingsSection` is a titled card of rows, and a `SettingsRow` is one setting: what it is on the left, the control on the right.

```tsx
import { SettingsRow, SettingsSection, TopIcon } from '@adecore/ui/settings';
```

<Demo src="settings/settings-section" />

## SettingsSection

A header with a title, a description, an `action` on the right and a `tag` after it, then the rows in one card, divided by hairlines. Without header props the section is the card alone.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. The rows. |
| `title` | `string` | | Also the section's accessible name. |
| `description` | `ReactNode` | | |
| `icon` | `LucideIcon` | | Before the title, muted, for a pane whose sections are kinds of thing. |
| `tag` | `ReactNode` | | |
| `action` | `ReactNode` | | |
| `footer` | `ReactNode` | | A note under the card, in the faint color. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLElement>` | | |

## SettingsRow

In a narrow window the control wraps under the label. Give the control its own accessible name, such as a `label` on a [`Switch`](/ui/inputs/switch) or [`Select`](/ui/inputs/select).

`indent` nests a row under the one above, for a setting that depends on it. `muted` mutes the label, for a row that only shows state. `children` go under the label at full width, such as swatches. `leading` sits before the label: a [`TopIcon`](#topicon) or a tile.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `ReactNode` | | Required. |
| `description` | `ReactNode` | | |
| `control` | `ReactNode` | | |
| `children` | `ReactNode` | | |
| `muted` | `boolean` | `false` | |
| `leading` | `ReactNode` | | |
| `indent` | `boolean` | `false` | |
| `searchId` | `string` | | The id a search result names to lead here. See [search](/ui/settings/settings-dialog#search). |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

## TopIcon

An icon that stays on the first line of wrapping text. It takes `icon`, `size` (default 16), `className` (on the icon) and `ref` (on the box).

## useSettingsTarget

A row a search result leads to scrolls into view and flashes. For a control of your own that should react too, such as opening a disclosure, call `useSettingsTarget()`. It returns `{ target, shown }`: the `searchId` jumped to or `null`, and the function to call once shown.

`SettingsSectionProps`, `SettingsRowProps` and `TopIconProps` are exported types.
