# Series chart

Values per bucket on a shared x axis of moments, numbers or categories. Here, errors and warnings per hour, with a deploy and a gap in the data:

<Demo src="charts/errors-per-hour" />

```tsx
<Chart.Root data={buckets} x="at" xScale="time" y={{ integer: true }} label="Events per hour" height={220}>
    <Chart.Grid />
    <Chart.Band from={gap.start} to={gap.end} label="No data from the collector" />
    <Chart.XAxis />
    <Chart.YAxis />
    <Chart.Area value="errors" label="Errors" tone="error" />
    <Chart.Line value="warnings" label="Warnings" tone="needsYou" />
    <Chart.Marker at={deploy.at} label={`Deploy ${deploy.version}`} tone="accent" />
    <Chart.Tooltip />
    <Chart.Legend />
    <Chart.Table />
</Chart.Root>
```

## Chart.Root

Each row of `data` is one bucket. `x` names its position, as a key of the row or a function of it. `xScale` sets the kind of position:

- `band` (default): a category per row, such as a day or a model.
- `time`: a moment, as a `Date` or in milliseconds. Each row is a bucket that starts at its x and lasts one `step`. Without a `step`, the chart takes the smallest distance between two rows.
- `linear`: a number.

Columns need `band` or `time`. Rows that are samples, not buckets, take `step={0}`, and the cursor snaps to the nearest sample. `xOptions` (`{ min, max }`, a `ChartXOptions`) fixes the ends of a time or linear axis, so a live window does not stretch while the first samples arrive. Leave rows outside those ends out of `data`, or they draw past the axis.

The value axis is `linear` or `log` (`yScale`). It covers every series, stacked ones at their top. A linear axis starts at zero and rounds its ends out to a tick. `y` takes:

- `min`, `max`: fixed ends.
- `integer: true`: whole-number ticks, for counts.
- `include: [1]`: a value the axis always covers, so a share near zero does not fill the plot.
- `headroom`: room above the highest value. `'tick'` (default) rounds up to the next tick, `'step'` adds a whole step when the value lands on a tick, and `'none'` lets the highest column fill the plot.

The width follows the container. `height` covers the plot and the x axis.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `data` | `readonly Row[]` | | Required. One row per bucket. |
| `x` | `keyof Row \| (row, index) => ChartXInput` | | Required. |
| `label` | `string` | | Required. The name a screen reader reads, and the caption of the table. |
| `xScale` | `'band' \| 'time' \| 'linear'` | `'band'` | |
| `step` | `number` | | Bucket length on a time scale, in milliseconds. Set it when rows may be missing and for columns. `0` for samples. |
| `xOptions` | `ChartXOptions` | | The ends of a time or linear x axis. |
| `yScale` | `'linear' \| 'log'` | `'linear'` | |
| `y` | `ChartYOptions` | `{}` | `min`, `max`, `include`, `integer`, `step` and `headroom`. |
| `height` | `number` | `200` | Pixels. |
| `grow` | `boolean` | `false` | Fills the container's height, never less than `height`. The container needs a height of its own. |
| `margin` | `ChartMargin` | | Pixels around the plot, beside the axes. Defaults: `top` 8, `bottom` 4 under an x axis, `left` and `right` 6 on a time or linear scale without buckets. Set them to 0 for a chart that draws to its edges. |
| `surface` | `'base' \| 'raised'` | `'base'` | The surface behind the chart, used for label halos and point rings. Pass `'raised'` in a dialog or a popover. |
| `interactive` | `boolean` | `true` | `false` makes the chart an image named by `label`, with no tab stop, keys or live region; see [keyboard and screen reader](/charts/#keyboard-and-screen-reader). |
| `cursor` | `'full' \| 'line' \| 'none'` | `'full'` | How the cursor shows: a lit bucket on a band scale or a line with dots on a time or linear one, the line alone, or nothing beyond the tooltip. Picked buckets stay lit. |
| `format` | `(value: number) => string` | | Writes values in the tooltip, live region and table, and on a y axis without its own `format`. |
| `rowLabel` | `keyof Row \| (row, index) => string` | | The bucket name in the tooltip, live region and table, in place of the axis label: "Fri, Oct 9" for "Oct 9". |
| `activeX`, `onActiveXChange` | `ChartX \| null` | | The cursor, controlled. Leaving the chart calls `onActiveXChange(null)`. |
| `group`, `groupLabel`, `groupGap`, `minBucketWidth` | | | Groups of columns, see [Columns and groups](/charts/columns). |
| `orientation`, `rowHeight` | `'vertical' \| 'horizontal'`, `number` | `'vertical'`, `32` | Rows of bars with their names on the left, and the pixels each row takes; see [horizontal bars](/charts/columns#horizontal-bars). |
| `selected`, `onActivate`, `dimmed` | | | Columns a person picks, see [Columns and groups](/charts/columns#picking-columns). |
| `className`, `ref` | | | On the outer box. |

A `ChartX` is a number (a moment in milliseconds) or the key of a category; a `ChartXInput` may also be a `Date`. `ChartXScale`, `ChartYScale`, `ChartYOptions`, `ChartAccessor` and `ChartRootProps` are exported as types.

## Grid and axes

`Chart.Grid` draws a line on every tick of the value axis, with a stronger ground line. `axis` takes `'y'` (default), `'x'` or `'both'`. `dashed` dashes every line but the ground. `lines="ground"` draws the ground alone, for columns that carry their own value labels.

`Chart.YAxis` writes ticks beside the plot, on the `left` or `right` (`side`), and sizes itself to its widest label. `Chart.XAxis` writes them under the plot. Time labels come from `@adecore/ui/format`. Labels that would overlap or hang past the edge are thinned out. On a time scale of columns, `align="bucket"` writes each bucket's start under its column instead of round moments on ticks.

Axis props:

- `format` writes a value or an x, also in the tooltip, live region and table. With a `Chart.YAxis` on each side, each keeps its own `format`, `ticks` and `title`, and the tooltip uses the left one.
- `ticks` asks for a number of ticks.
- `title` names what the axis measures. On `Chart.YAxis` it stands above the plot, on `Chart.XAxis` under the labels. A `log` axis adds "logarithmic", which `logLabel` replaces (an empty string drops it).
- `label` on `Chart.XAxis` names the x in the tooltip, live region and table when the title is too long.
- `onThinnedChange` reports whether a label per bucket was dropped for lack of room, so the app can point to the table.
- `thin={false}` keeps every label of a band scale. A second `Chart.XAxis` writes its row under the first; see [a ranked row](/charts/columns#a-ranked-row).
- `maxWidth` limits the column of names in a [horizontal chart](/charts/columns#horizontal-bars).

The props are `ChartGridProps`, `ChartXAxisProps` and `ChartYAxisProps`.

## Lines and areas

`Chart.Line` draws a line through `value`. A missing value (`null` or not a finite number) breaks the line. An isolated value gets a dot. `curve` is `linear`, `monotone` or `step` (`ChartCurve`). `dashed` dashes the line, `dots` dots every value, and `width` defaults to 2 pixels.

`Chart.Area` is a line with its area filled down to zero. With `stack` it stands on the stacked areas before it. Its fill fades toward the ground; `fill="flat"` tints it evenly, as stacked areas always are. `width={0}` drops the line along its top.

`icon` takes a Lucide icon and draws it in place of the series swatch in the legend and tooltip; `Chart.Bar` takes one too. The props are `ChartLineProps` and `ChartAreaProps`. `tone` is a `ChartColor`: a `ChartTone` or `{ color }`.

## A small chart of samples

A decorative chart beside a number: machine CPU as a line and one app's share as a flat area, over the last ten minutes. `step={0}` treats rows as samples, `xOptions` fixes the window, and `margin` lets the plot reach its edges. `interactive={false}` makes it an image, and `onActiveXChange` writes the hovered sample into the number:

<Demo src="charts/process-load" />

```tsx
<Chart.Root
    data={samples}
    x="at"
    xScale="time"
    step={0}
    xOptions={{ min: end - WINDOW, max: end }}
    y={{ min: 0, max: 100 }}
    height={44}
    margin={{ top: 1, right: 0, bottom: 1, left: 0 }}
    interactive={false}
    cursor="line"
    label="CPU of the machine and of this app, the last ten minutes"
    onActiveXChange={setHovered}
>
    <Chart.Grid lines="ground" dashed />
    <Chart.Area value="app" label="This app" tone="accent" width={0} fill="flat" />
    <Chart.Line value="machine" label="Machine" tone={{ color: 'var(--text-muted)' }} width={1} />
</Chart.Root>
```

## Markers and bands

`Chart.Marker` draws a dashed vertical line at the moment `at`. Its `label` shows in the tooltip of the bucket the moment falls in. `Chart.Band` hatches the range `from` to `to`, named in the tooltip of every bucket it touches. `detail` adds a second line under the label, read by the live region too. The tooltip hands both to its `children` as `ChartNote`s. Both are muted unless they get a `tone`.

On a band scale, `at`, `from` and `to` are bucket keys. A moment between two buckets needs a time scale, which also takes [columns](/charts/columns#columns-over-time). The props are `ChartMarkerProps` and `ChartBandProps`.

## Rules

`Chart.Rule` draws a horizontal line at `value`, such as a budget, with its `label` and value over the right end ("A · 71"). It draws above the series, and the value axis always covers it. `tone` colors it (muted by default) and `dashed` dashes it. The tooltip leaves rules out; a screen reader hears them once, with the chart's description. The props are `ChartRuleProps`.

```tsx
<Chart.Rule value={300} label="Budget" tone="error" dashed />
```

## Tooltip, legend and table

On a time scale the cursor takes the bucket under the pointer and shows nothing over a missing row. On a linear scale it snaps to the nearest point. `onActiveXChange` fires once per bucket the pointer enters, with `null` over a missing row or when the pointer leaves.

`Chart.Tooltip` is the card at the cursor: the bucket's x, a row per series (`-` without a value), then its markers and bands. It hangs on the side with the most room. `placement` (a `ChartTooltipPlacement`: `top-left`, `top-right`, `bottom-left` or `bottom-right`) pins it to a corner of the plot instead; it flips when it would cover the cursor. `total` adds the sum of the series as "Total", or under a name (`total="Runs"`). `format` writes the card's values. `children` receives the `ChartBucket`, with a `ChartBucketValue` per series, and draws the card's contents.

`Chart.Legend` lists the series and their colors above the plot. `Chart.Table` is a "Show values" toggle with the data as a table, which a screen reader reads even while closed. `toggle={false}` drops the button and keeps the table for screen readers only. `open`, `defaultOpen` and `onOpenChange` control it. `data` (a `ChartTableData` of `columns` and `rows`, each row with a `key`, a `label` and a written value per column) replaces the chart's rows with the app's own. The props are `ChartTooltipProps`, `ChartLegendProps` and `ChartTableProps`.

## Durations and runs of an endpoint

Two charts of one endpoint over a day, in 30-minute buckets, with two deploys. The durations use `formatPreciseDuration` from `@adecore/ui/format`:

<Demo src="charts/transaction-duration" />

```tsx
<Chart.Root data={buckets} x="at" xScale="time" step={HALF_HOUR} label="p50 and p95 duration over time">
    <Chart.Grid />
    <Chart.XAxis />
    <Chart.YAxis format={formatPreciseDuration} />
    <Chart.Line value="p50" label="p50" />
    <Chart.Line value="p95" label="p95" />
    {deploys.map((deploy) => (
        <Chart.Marker key={deploy.version} at={deploy.at} label={`Deploy ${deploy.version}`} tone="accent" />
    ))}
    <Chart.Tooltip />
    <Chart.Legend />
</Chart.Root>
```

The runs are stacked columns with their sum in the tooltip:

<Demo src="charts/transaction-runs" />

```tsx
<Chart.Root data={buckets} x="at" xScale="time" step={HALF_HOUR} y={{ integer: true }} label="Runs and failures over time">
    <Chart.Grid />
    <Chart.XAxis />
    <Chart.YAxis />
    <Chart.Bars stack>
        <Chart.Bar value="succeeded" label="Succeeded" />
        <Chart.Bar value="failed" label="Failed" tone="error" />
    </Chart.Bars>
    {deploys.map((deploy) => (
        <Chart.Marker key={deploy.version} at={deploy.at} label={`Deploy ${deploy.version}`} tone="accent" />
    ))}
    <Chart.Tooltip total="Runs" />
    <Chart.Legend />
</Chart.Root>
```

A [`Chart.Group`](/charts/shared-cursor) around both shares the cursor.
