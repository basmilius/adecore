# DisabledReason

Why a row cannot be picked, in a tooltip beside it, so the sentence does not widen the menu.

```tsx
import { DisabledReason } from '@adecore/ui';
```

<Demo src="overlays/disabled-reason" />

Open the menu and hover Push. With `reason={null}` the row renders unchanged, so you can wrap every row the same way.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `reason` | `string \| null` | | Required. |
| `children` | `ReactElement` | | Required. The row. |

`DisabledReasonProps` is an exported type.
