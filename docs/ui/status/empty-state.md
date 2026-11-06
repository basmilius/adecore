# EmptyState

What a list, a canvas or a thread shows before it holds anything: one icon, one sentence, and at most one button.

```tsx
import { EmptyState } from '@adecore/ui';
```

<Demo src="display/empty-state" />

The sentence says what is missing and what puts something there. A `title` is for an outcome, such as a search with no results. The icon is a Lucide icon or another mark that takes a `size`, drawn at 20 pixels. `busy` draws a [`Spinner`](/ui/status/spinner) in its place. For a place a person may not know yet, `scene` takes a drawing, usually an [`EmptyScene`](/ui/status/empty-scene), in place of the icon, and the title grows with it.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Required. One sentence. |
| `icon` | `LucideIcon \| ReactElement<{ size?: number }>` | | |
| `scene` | `ReactNode` | | A drawing in place of the icon. |
| `busy` | `boolean` | `false` | A `Spinner` in place of the icon, for a state that is still loading. |
| `title` | `ReactNode` | | |
| `action` | `ReactNode` | | One button. |
| `className` | `string` | | |
| `ref` | `Ref<HTMLDivElement>` | | |

`EmptyStateProps` is an exported type.
