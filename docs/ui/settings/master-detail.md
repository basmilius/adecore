# MasterDetail

A list beside the detail of what is picked in it, for a settings pane of many things of one kind: accounts, devices, shortcut groups. Each side scrolls on its own, and the detail takes the rest of the width.

```tsx
import { DetailHeader, MasterDetail, MasterItem } from '@adecore/ui/settings';
```

<Demo src="settings/master-detail" fill />

Inside a [`SettingsDialog`](/ui/settings/settings-dialog), put it in a `split` section, so the dialog hands the pane its whole height instead of a padded scrolling column. Under 640 pixels the list stacks above the detail.

## Parts

`MasterDetail` takes the `list`, its width (`280`, `320` or `340` pixels), a `listLabel` that names the list for a screen reader, and the `detail`.

`MasterItem` is one row of the list, a button that lifts a shade when `selected` and carries `aria-current`. It takes `selected`, `onSelect` and `children`.

`DetailHeader` is the head of a detail: a `mark` (a logo or an icon tile), the `title`, a `subtitle` line under it, and the `actions` of the thing on the right.

| Component | Prop | Type |
| --- | --- | --- |
| `MasterDetail` | `list` | `ReactNode` |
| | `listWidth` | `280 \| 320 \| 340` |
| | `listLabel` | `string` |
| | `detail` | `ReactNode` |
| `MasterItem` | `selected` | `boolean` |
| | `onSelect` | `() => void` |
| | `children` | `ReactNode` |
| `DetailHeader` | `mark` | `ReactNode` |
| | `title` | `string` |
| | `subtitle` | `ReactNode` |
| | `actions` | `ReactNode`, optional |

Every prop is required unless it says otherwise, and all three take `className` and `ref`. `MasterDetailProps`, `MasterItemProps` and `DetailHeaderProps` are exported types.
