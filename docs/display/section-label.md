# SectionLabel

The small label above a group of rows outside a popup: a sidebar's groups, a palette's sections, the name of a field. Inside a menu the same job is `Menu.GroupLabel` or `Menu.Label`.

```tsx
import { SectionLabel } from '@basmilius/react-ui';
```

<Demo src="display/section-label" />

It is a `<span>` unless `render` makes it a heading or a `<label>`. It takes the line height of the row it sits in. Write it in sentence case, never uppercase.

`SectionLabel` takes the props of a `<span>`, `className`, `ref` and `render`. `SectionLabelProps` is an exported type.
