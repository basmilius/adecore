# DisabledReason

Why a row cannot be picked, in a tooltip to the right of it rather than in the row itself. A reason is a sentence, and a sentence in a menu row would set the width of the whole menu.

```tsx
import { DisabledReason } from '@adecore/ui';
```

<Demo src="overlays/disabled-reason" />

Open the menu and rest the pointer on Push. A row with nothing in its way (`reason={null}`) is handed back untouched, without a tooltip, so you can wrap every row the same way and let the reason decide.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `reason` | `string \| null` | | Required. |
| `children` | `ReactElement` | | Required. The row. |

`DisabledReasonProps` is an exported type.
