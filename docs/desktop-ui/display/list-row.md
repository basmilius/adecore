# ListRow

The height and the shape of one row of a list. What the row does (a button, a link, a menu trigger) comes from `render`.

```tsx
import { ListRow } from '@basmilius/desktop-ui';
```

<Demo src="display/list-row" />

There are two variants, and `variant` is required.

A `flat` row is 28 pixels tall and square, for a list that reads as a table and fills the width of its panel: commits, processes, branches. It has no padding; pad 12 pixels beside text and 4 beside a button.

An `inset` row is 32 pixels tall, rounded and padded, for a list a person finds their way through: a sidebar, devices, recent files. Each row reads as a place of its own.

`ListRow` takes the props of a `<div>`, `className`, `ref` and `render`. `ListRowProps` is an exported type.
