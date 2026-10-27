# Series chart

Values per bucket on a shared x axis: a moment, a number or a category. Errors and warnings per hour over a day, with a deploy and a stretch the collector was down:

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

Each row of `data` is one bucket. `x` names its position, as a key of the row or a function of it. `xScale` says what the position is:

- `band` (the default): a category per row, such as a day or a model, with the buckets side by side.
- `time`: a moment, as a `Date` or in milliseconds. The rows run from the earliest to the latest. Each row is a bucket that starts at its x and lasts one `step`, the smallest distance between two rows unless the root gets one; its point stands in the middle of it, where a column would. Columns stand on this scale and on `band`, not on `linear`.
- `linear`: a number, the rows from low to high.

Rows that are samples at a moment, not buckets that last a while, take `step={0}`: each point stands at its own x and the cursor takes the nearest sample. `xOptions` (`{ min, max }`, a `ChartXOptions`) fixes the ends of a time or linear axis, such as the last five minutes up to the newest sample, so the plot does not stretch while the first samples come in. Rows outside the ends are drawn past them; leave them out of `data`.

The value axis is `linear` or `log` (`yScale`). It covers every series, stacked ones at their top, starts at zero on a linear scale and rounds its ends out to a tick. `y` fixes the ends (`{ min, max }`), and `{ integer: true }` keeps the ticks of a count on whole numbers. `{ include: [1] }` makes the axis cover a value the data may not reach and still round out above it, so a share that stays near zero does not fill the plot; larger data still raises the top. `headroom` says what the top leaves above the highest value: up to the next tick (`'tick'`, the default, so a value on a tick touches the top), a whole step more when the value lands on a tick (`'step'`), or nothing (`'none'`), so the highest column fills the plot.

The width follows the container; `height` (200 by default) is the height of the plot and the x axis together.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `data` | `readonly Row[]` | | Required. One row per bucket. |
| `x` | `keyof Row \| (row, index) => ChartXInput` | | Required. |
| `label` | `string` | | Required. The name a screen reader reads, and the caption of the table. |
| `xScale` | `'band' \| 'time' \| 'linear'` | `'band'` | |
| `step` | `number` | | The length of a bucket on a time scale, in milliseconds. Set it when rows may be missing at the start, and for columns, which one row cannot draw without it. `0` for samples. |
| `xOptions` | `ChartXOptions` | | The ends of a time or linear x axis. |
| `yScale` | `'linear' \| 'log'` | `'linear'` | |
| `y` | `ChartYOptions` | `{}` | `min`, `max`, `include`, `integer`, `step` and `headroom`. |
| `height` | `number` | `200` | Pixels. |
| `grow` | `boolean` | `false` | Takes the height the container gives the chart, never less than `height`, such as a chart that fills a panel or a dialog. The container needs a height of its own. |
| `margin` | `ChartMargin` | | Pixels around the plot, beside what the axes take. `top` is 8, for something drawn over the plot; `bottom` is 4 under an x axis and 0 without one; `left` and `right` are 6 on a time or linear scale without buckets, so the dot at the end of a line keeps its edge, and 0 otherwise. A chart that draws to its edges, such as a small line in a panel, sets them to 0. |
| `surface` | `'base' \| 'raised'` | `'base'` | The surface the chart stands on. The halo that keeps a value label, a rule label or a guide value readable over the series, and the ring around a point, are drawn in it, so a chart in a dialog or a popover passes `'raised'`. |
| `interactive` | `boolean` | `true` | False makes the chart an image with its `label`, without a tab stop, keys or a live region; see [keyboard and screen reader](/charts/#keyboard-and-screen-reader). |
| `cursor` | `'full' \| 'line' \| 'none'` | `'full'` | What marks the cursor: a lit bucket on a band scale and a line with a dot on every series on a time or linear one, the line alone, or nothing past the dimmed columns and the tooltip. Picked buckets stay lit. |
| `format` | `(value: number) => string` | | Writes a value in the tooltip, the live region and the table, and on a y axis without a `format` of its own. A chart without a y axis needs it to read a duration as one. |
| `rowLabel` | `keyof Row \| (row, index) => string` | | What a person reads for a bucket in the tooltip, the live region and the table, in place of what the x axis writes: "Low" under a column labeled "L", or "Fri, Oct 9" under "Oct 9". On a point chart it names the point beside its group. |
| `activeX`, `onActiveXChange` | `ChartX \| null` | | The cursor, controlled. Leaving the chart calls `onActiveXChange(null)`; the app decides whether the cursor goes. |
| `group`, `groupLabel`, `groupGap`, `minBucketWidth` | | | Groups of columns, see [Columns and groups](/charts/columns). |
| `orientation`, `rowHeight` | `'vertical' \| 'horizontal'`, `number` | `'vertical'`, `32` | Rows of bars with their names on the left, and the pixels each row takes; see [horizontal bars](/charts/columns#horizontal-bars). |
| `selected`, `onActivate`, `dimmed` | | | Columns a person picks, see [Columns and groups](/charts/columns#picking-columns). |
| `className`, `ref` | | | On the outer box. |

A `ChartX` is a number (a moment in milliseconds) or the key of a category; a `ChartXInput` may also be a `Date`. `ChartXScale`, `ChartYScale`, `ChartYOptions`, `ChartAccessor` and `ChartRootProps` are exported as types.

## Grid and axes

`Chart.Grid` draws a line on every tick of the value axis in `--border-soft`, with the ground in `--border-strong`, so columns and areas stand on a line that reads. `axis` takes `'y'` (the default), `'x'` or `'both'`. `dashed` dashes every line but the ground, all of them in `--border` so the dashes still read as a line. `lines="ground"` draws the ground alone, for columns that carry their value over them and need no scale.

`Chart.YAxis` writes the ticks beside the plot, on the `left` or the `right` (`side`). It measures its widest label and gives the plot the rest of the width. `Chart.XAxis` writes them under it. On a time scale the labels are the clock within a day, the day once the ticks are a day apart, and both in between, from `@adecore/ui/format`. Labels that would overlap thin out, and a label that would hang past the end of the chart is left out, except on a tick at an end of the axis, such as the last decade of a `log` scale, which moves inward. A label that would come nearer to the one before it than its width gives way, an end label excepted, and an axis without rows writes nothing. On a time scale of columns, `align="bucket"` writes the start of each bucket under its middle instead of round moments on their ticks, so the label of a day stands under its own column.

`format` writes a value or an x. The format of an axis is also how the tooltip, the live region and the table write it. A `Chart.YAxis` on each side keeps its own `format`, `ticks` and `title` over the one value scale. The tooltip writes a value in the `format` of the left one and the scale takes its `ticks`, or those of the right one where the left has none. `ticks` asks for a number of ticks. `label` on `Chart.XAxis` is what the tooltip, the live region and the table call the x of a point where the title is too long to read out each time, and `logLabel` replaces "logarithmic" after the title of a `log` axis, or drops it as an empty string. `title` names what an axis measures: on `Chart.YAxis` it stands above the plot where the axis starts, such as a unit ("Index points, higher is better"), and the plot moves down to make room; on `Chart.XAxis` it stands centered under the labels, and a `log` scale adds "logarithmic" to it. `onThinnedChange` hears whether an axis with a label per bucket left some out for lack of room, so an app can say that the table has them all. A second `Chart.XAxis` writes its row under the first, and `thin={false}` keeps every label of a band scale; see [a ranked row](/charts/columns#a-ranked-row). In a horizontal chart the axes trade places and `maxWidth` limits the column of names; see [horizontal bars](/charts/columns#horizontal-bars). `ChartGridProps`, `ChartXAxisProps` and `ChartYAxisProps` are the props.

## Lines and areas

`Chart.Line` draws a line through `value`. A missing value (`null`, or anything that is no finite number) breaks the line, and a value with no neighbor gets a dot, so it does not vanish. `curve` is `linear`, `monotone` or `step` (`ChartCurve`); `dashed` dashes the line and `dots` puts a dot on every value. `width` is 2 pixels, or 1 for a small chart beside others.

`Chart.Area` is a line with its area filled down to zero. With `stack` it stands on the stacked areas before it instead, and the value axis covers the top of the pile. Its fill fades toward the ground; `fill="flat"` tints it evenly at 28%, as a stacked area always is. `width` sets the line along its top, and `0` leaves the area alone, such as a share under a line of the whole.

`icon` takes a Lucide icon, as `Icon` of `@adecore/ui` does, and draws it in the color of the series in place of its swatch, in the legend and the tooltip; `Chart.Bar` takes one too. The props are `ChartLineProps` and `ChartAreaProps`; `tone` is a `ChartColor`, a `ChartTone` or `{ color }`.

## A small chart of samples

A chart beside a number in a panel: the CPU of the machine as a 1px line and the share of one app as a flat area under it, sampled every ten seconds over the last ten minutes. `step={0}` makes each row a sample at its moment, `xOptions` fixes the window so it ends at the newest sample, and `margin` lets the plot reach its edges. It only decorates the number above it, so it is an image (`interactive={false}`), and `cursor="line"` marks the pointer with a line alone. `onActiveXChange` writes the hovered sample into that number:

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

`Chart.Marker` draws a dashed vertical line at a moment, `at`, with a dot on top. A moment outside the x axis draws nothing. Its `label` is named in the tooltip of the bucket the moment falls in, so a deploy at 14:37 shows under the bucket of 14:00. `Chart.Band` shades a range from `from` to `to` with a hatch, named in the tooltip of every bucket it touches. A short range is still 4px wide, so it reads as a band and not as a marker. In the tooltip a marker has a dashed swatch and a band a square, both in their color, and `detail` adds a second line under the label, such as "Data may be missing."; the live region reads it too. The tooltip hands them to its `children` as `ChartNote`s. Both are muted unless they get a `tone`. On a band scale `at`, `from` and `to` are keys of buckets; a moment between two buckets needs a time scale, which takes [columns](/charts/columns#columns-over-time) too. The props are `ChartMarkerProps` and `ChartBandProps`.

## Rules

`Chart.Rule` draws a horizontal line across the plot at `value`, such as a budget or a column picked as a reference, with its `label` and the value over its right end ("A · 71"): right aligned with the end of the line, 7px above it, in a halo of the [surface](#chart-root) so it reads over the columns, and under the line where there is no room above it. It draws above the series whatever its place among the children, and the value axis covers it, also where the data stays below it. `tone` colors it (muted by default) and `dashed` dashes it.

A rule holds for every bucket, so the tooltip does not repeat it; a screen reader hears it once, with the description of the chart. The props are `ChartRuleProps`.

```tsx
<Chart.Rule value={300} label="Budget" tone="error" dashed />
```

## Tooltip, legend and table

On a time scale the cursor takes the bucket under the pointer, the same bucket a marker there is named in; where a row is missing it shows nothing. On a linear scale it snaps to the nearest point. On a time or linear scale it draws a line with a dot on every series; on a band scale it lights the bucket. Leaving the chart clears it; with `activeX` controlled it calls `onActiveXChange(null)` instead. `onActiveXChange` hears the x of a bucket, once each time the pointer enters another one, and `null` over a missing row.

`Chart.Tooltip` is the card at the cursor: the x of the bucket, a row per series (with `-` where the series has no value), then its markers and bands. It hangs on the side of the cursor with the most room. `placement` fixes it in a corner of the plot instead (`top-left`, `top-right`, `bottom-left` or `bottom-right`, a `ChartTooltipPlacement`), where it moves to the other side when it would cover the bucket under the cursor. `total` adds the sum of the series as "Total", or under the name it is given (`total="Runs"`), and `format` writes the values of the card. `children` takes the bucket (`ChartBucket`, with a `ChartBucketValue` per series) and draws the card's contents instead.

`Chart.Legend` lists the series with their color, in the order of the children, above the plot. `Chart.Table` is a "Show values" toggle under it with the data as a table, which a screen reader reads also while it is closed. `toggle={false}` leaves the button out and keeps the table for a screen reader only; `open`, `defaultOpen` and `onOpenChange` hold it open from the app, such as a toggle it keeps in its own state. `data` (a `ChartTableData` of `columns` and `rows`, each row with a `key`, a `label` and a written value per column) shows rows of the app's own in place of the chart's, such as series the chart leaves out. The props are `ChartTooltipProps`, `ChartLegendProps` and `ChartTableProps`.

## Durations and runs of an endpoint

Two charts of one endpoint over a day in buckets of 30 minutes, with the two deploys that slowed it down and fixed it again. The durations are lines with `formatPreciseDuration` of `@adecore/ui/format` on the axis and in the tooltip:

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

The runs are stacked columns on whole numbers, the failed ones in the error tone, with their sum named in the tooltip:

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

Put both in a [`Chart.Group`](/charts/shared-cursor) and the cursor follows the pointer through both.
