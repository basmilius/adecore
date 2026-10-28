# MasterDetail

A list beside the detail of its picked item, for a settings pane of many things of one kind: accounts, devices. Each side scrolls on its own.

```tsx
import { DetailHeader, MasterDetail, MasterItem } from '@adecore/ui/settings';
```

<Demo src="settings/master-detail" fill />

In a [`SettingsDialog`](/ui/settings/settings-dialog), use a `split` section for the full height. Under 640 pixels wide the list stacks above the detail.

## Parts

`MasterDetail` takes the `list`, `listWidth`, a `listLabel` for screen readers, and the `detail`.

`MasterItem` is one list row, a button with `aria-current` when `selected`.

`DetailHeader` heads a detail: a `mark` (logo or icon tile), the `title`, a `subtitle` and `actions` on the right.

## Props

| Component | Prop | Type | Default | |
| --- | --- | --- | --- | --- |
| `MasterDetail` | `list` | `ReactNode` | | Required. |
| | `listWidth` | `280 \| 320 \| 340` | | Required. In pixels. |
| | `listLabel` | `string` | | Required. |
| | `detail` | `ReactNode` | | Required. |
| `MasterItem` | `selected` | `boolean` | | Required. |
| | `onSelect` | `() => void` | | Required. |
| | `children` | `ReactNode` | | Required. |
| `DetailHeader` | `mark` | `ReactNode` | | Required. |
| | `title` | `string` | | Required. |
| | `subtitle` | `ReactNode` | | Required. |
| | `actions` | `ReactNode` | | |

All three take `className` and `ref`. `MasterDetailProps`, `MasterItemProps` and `DetailHeaderProps` are exported types.
