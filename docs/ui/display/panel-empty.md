# PanelEmpty

An [`EmptyState`](/ui/display/empty-state) that fills a panel or a card, centered in the room left under the panel's header.

```tsx
import { PanelEmpty } from '@adecore/ui';
```

<Demo src="display/panel-empty" />

By default it grows into the rest of a flex column (`fill="grow"`). In a card with its own height, use `fill="full"`. `sunken` gives it the sunken ground. `header` keeps the panel's header above the sentence, so its actions stay reachable.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. |
| `header` | `ReactNode` | | |
| `icon` | `LucideIcon` | | |
| `busy` | `boolean` | `false` | A `Spinner` in place of the icon. |
| `action` | `ReactNode` | | |
| `sunken` | `boolean` | `false` | |
| `fill` | `'grow' \| 'full'` | `'grow'` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`PanelEmptyProps` is an exported type.
