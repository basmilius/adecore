# Separator

A hairline between two groups of controls in a toolbar-like row. It carries no margin; the row's gap puts space on either side of it, which is what makes the line read as a divider and not as a group of its own.

```tsx
import { Separator } from '@adecore/ui';
```

<Demo src="display/separator" />

It is vertical and 16 pixels tall by default; `orientation="horizontal"` runs the full width. It is hidden from screen readers. Between two groups of menu rows use `Menu.Separator` instead.

| Prop | Type | Default |
| --- | --- | --- |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` |
| `className` | `string` | |
| `ref` | `Ref<HTMLSpanElement>` | |

`SeparatorProps` is an exported type.
