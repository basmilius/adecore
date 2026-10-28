# Heatmap

A grid of rows by columns, each cell shaded by its value, such as events by weekday and hour.

```tsx
import { Heatmap } from '@adecore/charts';
```

## By weekday and hour

<Demo src="charts/events-by-weekday" />

```tsx
const rows = days.map((at, day) => ({ key: day, label: formatWeekday(at, 'long'), short: formatWeekday(at) }));
const columns = hours.map((at, hour) => ({ key: hour, label: formatClock(at), short: hour % 6 === 0 ? formatHour(at) : null }));

<Heatmap rows={rows} columns={columns} values={counts} label="Error events per weekday and hour" valueLabel="Events" />
```

`values` holds a list per row, a value per column. Each row and column has a `key`, a `label` for the tooltip, live region and table, and a `short` for the axis (`null` leaves the axis blank there). Write both with [`formatWeekday`, `formatHour` and `formatClock`](/ui/formatting/dates). Rows draw in the given order, so the app picks the first weekday and counts in the reader's time zone.

## Any grid

Failed checks per suite and platform, in four steps of the error tone, with a "Show values" toggle. A `null` cell has no value:

<Demo src="charts/failures-by-suite" />

```tsx
<Heatmap
    rows={suites}
    columns={platforms}
    values={failures}
    label="Failed checks per suite and platform, last 50 runs"
    valueLabel="Failed checks"
    tone="error"
    steps={4}
    cellHeight={28}
    table
/>
```

## Shades

A cell's shade is its value's share of `max` (the highest value by default), from 15% to the full `tone` color. With `steps`, values fall into that many shades instead. Zero, negative and `null` cells are empty; the card reads `null` as "No data". Give two heatmaps the same `max` to compare them.

The legend under the grid runs from "Less" to "More". `legend={false}` hides it.

## Keyboard and screen reader

The grid is one tab stop, a `group` named by `label`. The cell under the pointer or keyboard gets an outline and a card with its row, column and value.

| Key | Moves to |
| --- | --- |
| Arrow keys | The next cell in that direction |
| Home, End | The first or the last cell of the row |
| Control with Home or End | The first or the last cell of the grid |
| Escape | Clears the cell |

A polite live region reads each cell the keyboard reaches: "Monday, 09:00, Events 41". A screen reader also gets the values as a table; `table` adds a "Show values" toggle that shows it to everyone.

`onActiveChange` receives the active `HeatmapCell` (`row` and `column` as indexes), or `null` when it leaves the grid.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `rows`, `columns` | `readonly HeatmapAxisItem[]` | | Required. `{ key, label, short? }`. |
| `values` | `readonly (readonly (number \| null)[])[]` | | Required. By row, then by column. |
| `label` | `string` | | Required. The name of the heatmap. |
| `valueLabel` | `string` | | Required. What a value counts, such as "Events". |
| `tone` | `ChartColor` | `'accent'` | |
| `steps` | `number` | | Shades besides the empty cell; without it the shade follows the value. |
| `max` | `number` | the highest value | The value of the full color. |
| `format` | `(value: number) => string` | `formatNumber` | Writes values in the card, live region and table. |
| `cellHeight` | `number` | `16` | Pixels. The cell width follows the container. |
| `legend` | `boolean` | `true` | |
| `table` | `boolean` | `false` | Shows the "Show values" toggle. |
| `onActiveChange` | `(cell: HeatmapCell \| null) => void` | | |
| `className`, `ref` | | | On the outer `<div>`. |

The props are `HeatmapProps`.
