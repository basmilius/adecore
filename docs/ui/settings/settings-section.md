# SettingsSection and SettingsRow

The parts a settings pane is built from. A `SettingsSection` is a titled card of rows, and a `SettingsRow` is one setting: what it is on the left, the control on the right.

```tsx
import { SettingsRow, SettingsSection, TopIcon } from '@adecore/ui/settings';
```

<Demo src="settings/settings-section" />

## SettingsSection

A section has a header line with a title and a description, a small `action` on the right and a `tag` after it, such as where the settings apply. The rows sit in one card and divide themselves with a hairline. A `footer` is a note under the card. Without a title, description, tag or action the section is the card alone.

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

Where the label and the control do not fit side by side, in a narrow window, the control wraps under the label instead of widening the dialog. The control carries its own accessible name, so a [`Switch`](/ui/inputs/switch) or a [`Select`](/ui/inputs/select) gets a `label` of its own.

`indent` steps a row in under the one above it, for a setting that only makes sense with that one on. `muted` draws the label in the muted color, for a row that only shows state. `children` go under the label line at full width, such as a row of swatches. `leading` stands before the label: a [`TopIcon`](#topicon) or a tile.

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

An icon beside text that may wrap. Its box is one line of `text-sm` high, so the icon stays on the first line. It takes `icon`, `size` (default 16), `className` (on the icon) and `ref` (on the box).

## useSettingsTarget

A row scrolls into view and lights up for 1.6 seconds when a search result leads to it. A control of your own that should react too, such as opening a disclosure, reads the same state with `useSettingsTarget()`. It returns `{ target, shown }`: the `searchId` a result jumped to, or `null`, and the function to call once the target was shown.

`SettingsSectionProps`, `SettingsRowProps` and `TopIconProps` are exported types.
