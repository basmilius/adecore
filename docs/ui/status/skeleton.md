# Skeleton

A pulsing bar where a value will be, while the answer is still on its way. It is one line of 16 pixels.

```tsx
import { Skeleton } from '@adecore/ui';
```

<Demo src="display/skeleton" />

`className` sets the width, and a height other than one line. Size it like the value it stands in for, so nothing moves when the value arrives. It is hidden from screen readers; say that something loads elsewhere if it matters.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `className` | `string` | | The width, and a height other than one line. |
| `ref` | `Ref<HTMLSpanElement>` | | |

`SkeletonProps` is an exported type.
