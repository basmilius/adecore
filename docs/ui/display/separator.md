# Separator

A hairline between two groups of controls in a toolbar-like row. It has no margin; the row's gap spaces it.

```tsx
import { Separator } from '@adecore/ui';
```

<Demo src="display/separator" />

It is vertical and 16 pixels tall by default; `orientation="horizontal"` runs the full width. It is hidden from screen readers. Between two groups of menu rows use `Menu.Separator` instead.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | |
| `className` | `string` | | |
| `ref` | `Ref<HTMLSpanElement>` | | |

`SeparatorProps` is an exported type.
