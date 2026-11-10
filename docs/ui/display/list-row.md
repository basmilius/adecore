# ListRow

The height and the shape of one row of a list. What the row does (a button, a link, a menu trigger) comes from `render`.

```tsx
import { ListRow } from '@adecore/ui';
```

<Demo src="display/list-row" />

`variant` is required. A `flat` row is 28 pixels tall and square, for a list that reads as a table and fills the width of its panel: commits, processes, branches. It has no padding; pad 12 pixels beside text and 4 beside a button.

An `inset` row is 32 pixels tall, rounded and padded 8 pixels, for a list a person finds their way through: a sidebar, devices, recent files.

A `stacked` row has the shape of an `inset` row and grows with its content. Its children stand in a column, for a row of several lines such as a message with its sender, subject and preview.

`selected` draws the selected ground and sets `aria-current`, or `aria-selected` when the row has `role="option"`. A row with `selected={false}` draws a hover. Without `selected` the row draws neither, and the caller adds them.

`indent` adds steps of 24 pixels to the start padding, for a row nested under another.

<Demo src="display/list-row-stacked" />

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `variant` | `'flat' \| 'inset' \| 'stacked'` | | Required. |
| `selected` | `boolean` | | |
| `indent` | `number` | `0` | Steps of 24 pixels. |
| `render` | `ReactElement` | `<div>` | What the row is. |

`ListRow` also takes the props of a `<div>`. `ListRowProps` is an exported type.
