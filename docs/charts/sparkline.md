# Sparkline

A small chart without axes, for a list row or a tile. A tooltip shows the total, and a screen reader hears the label with the total.

```tsx
import { Sparkline } from '@adecore/charts';
```

<Demo src="charts/sparkline-row" />

```tsx
<Sparkline values={perDay} kind="bars" label="Events of api in 14 days" width={82} height={16} />
<Sparkline values={tokens} label="Tokens in 14 days" tone="running" format={formatTokens} width={160} />
```

`kind="bars"` draws a rounded column per value, as wide as the width allows, with a baseline for zero. `kind="line"` (default) draws a line, broken by a missing value. The sparkline is one tab stop, so the tooltip opens from the keyboard too.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `values` | `readonly (number \| null)[]` | | Required. |
| `label` | `string` | | Required. What the values are, such as "events in 14 days". |
| `kind` | `'line' \| 'bars'` | `'line'` | |
| `tone` | `ChartColor` | `'accent'` | |
| `format` | `(value: number) => string` | `formatNumber` | Writes the total. |
| `width`, `height` | `number` | `96`, `24` | Pixels. |
| `className`, `ref` | | | On the `<svg>`. |

The props are `SparklineProps`.
