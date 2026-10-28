# Columns and groups

`Chart.Bar` draws a column per bucket, on a `band` or `time` scale. Tokens per day, stacked, with the total in the tooltip:

<Demo src="charts/tokens-per-day" />

```tsx
const UsageChart = createChart<TokenDay>();

<UsageChart.Root data={days} x="day" label="Tokens per day" height={220}>
    <UsageChart.Grid />
    <UsageChart.YAxis format={formatTokens} />
    <UsageChart.XAxis format={(day) => formatDay(day as number)} />
    <UsageChart.Bars stack>
        <UsageChart.Bar value="input" label="Input" />
        <UsageChart.Bar value="output" label="Output" />
    </UsageChart.Bars>
    <UsageChart.Tooltip total />
    <UsageChart.Legend />
</UsageChart.Root>
```

## Bars and Bar

`Chart.Bars` holds the bars that share a bucket. Without `stack` they stand side by side; with `stack` they pile up in the order of the children. Bars outside `Chart.Bars` stand side by side too.

By default a column takes 72% of its bucket, at most 56px. While the cursor is on a bucket, the other columns dim.

`tone` takes a tone, `{ color }`, or a function of the row: `tone={(row) => runTone(row.status)}`. `opacity` is a function of the row, its index in its group and the group size. The props are `ChartBarsProps` and `ChartBarProps`, and `ChartBarTone` is the type of `tone`.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value`, `label` | | | Required. The value, and the name in the tooltip, legend and table. |
| `tone` | `ChartBarTone` | the next chart color | |
| `opacity` | `(row, indexInGroup, groupSize) => number` | | |
| `hoverOpacity` | `number` | `0.55` | The other columns while the cursor is on a bucket; `1` keeps them. |
| `dimOpacity` | `number` | `0.4` | Dimmed columns, and unpicked ones while another is picked. |
| `columnWidth` | `(bucket: number) => number` | | Pixels the columns of a bucket take together. |
| `radius` | `number` | `2` | Corner radius of an unstacked column, at most a quarter of its width. |
| `rounded` | `'all' \| 'end'` | `'all'` | Round all corners, or only the end away from the ground. |
| `minHeight` | `number` | | Least height of an unstacked column, in pixels, also for zero. A missing value draws nothing; pass `?? 0` in `value` to draw a stub. |
| `animate` | `boolean` | `false` | Grow the columns once on first draw, unless the person asks for reduced motion. |
| `valueLabels` | `boolean \| (value, row, index) => string` | | Writes each column's value over it, see [value labels](#value-labels). |
| `valueLabelSize` | `'2xs' \| 'xs'` | `'2xs'` | The type size of the value labels. |

## Columns over time

On a `time` scale each bucket lasts one `step` from its x. A marker or band lands at its exact moment, and a missing row leaves its slot empty. Runs of a job per hour:

<Demo src="charts/columns-over-time" />

```tsx
<Chart.Root data={runs} x="at" xScale="time" step={HOUR} y={{ integer: true }} label="Runs and failures per hour" height={220}>
    <Chart.Grid />
    <Chart.Band from={gap.start} to={gap.end} label="No data from the collector" />
    <Chart.XAxis />
    <Chart.YAxis />
    <Chart.Bars stack>
        <Chart.Bar value="succeeded" label="Succeeded" />
        <Chart.Bar value="failed" label="Failed" tone="error" />
    </Chart.Bars>
    <Chart.Marker at={deploy.at} label={`Deploy ${deploy.version}`} tone="accent" />
    <Chart.Tooltip total="Runs" />
    <Chart.Legend />
</Chart.Root>
```

Pass `step` for columns on a time scale. Without it, a single row draws nothing (with a warning in development). On a `band` scale, a marker needs the key of a bucket.

## Groups

`group` on the root groups the buckets by a key, in the order of `data`, with `groupGap` pixels between groups (16 by default). Scores per model and effort:

<Demo src="charts/scores-by-model" />

```tsx
const ScoreChart = createChart<ModelScore>();

<ScoreChart.Root
    data={scores}
    x="key"
    group="model"
    groupGap={20}
    label="Scores per model and effort"
    y={{ min: 0, max: 80 }}
    minBucketWidth={28}
    selected={picked}
    onActivate={toggle}
>
    <ScoreChart.Grid dashed />
    <ScoreChart.YAxis ticks={4} title="Index points, higher is better" />
    <ScoreChart.XAxis format={(key) => effortOf(key)} thin={false} />
    <ScoreChart.Bar
        value="score"
        label="Intelligence"
        tone={(row) => ({ color: labColor(row.lab) })}
        opacity={(row, indexInGroup, groupSize) => 0.6 + (indexInGroup / Math.max(groupSize - 1, 1)) * 0.4}
        hoverOpacity={1}
        columnWidth={(bucket) => Math.max(6, Math.min(44, Math.floor(bucket) - 4))}
        radius={3}
        valueLabels
    />
    <ScoreChart.GroupAxis>
        {(group) => (
            <>
                <LabMark lab={group.rows[0].lab} />
                <span>{group.key}</span>
            </>
        )}
    </ScoreChart.GroupAxis>
    <ScoreChart.Tooltip />
</ScoreChart.Root>
```

`Chart.GroupAxis` is an HTML row of labels under the x axis, one centered under each group, so a logo fits. Its `children` is a function of the `ChartBucketGroup` (`key`, `label`, `rows`, and the indexes of its `first` and `last` bucket). The props are `ChartGroupAxisProps`.

The arrow keys move column by column across groups. Page Up and Page Down jump between groups. The live region names the group first ("Atlas 5, high, Intelligence 71").

The group key is an identity, such as a model id. `groupLabel` reads the readable name from the rows, as a key or a function (`groupLabel="modelName"`). The tooltip, live region, table and `Chart.GroupAxis` use it.

`minBucketWidth` is the narrowest a bucket may be. Below it the plot scrolls sideways and the y axis stays in place.

## Picking columns

With `onActivate`, buckets become pressable: Enter, Space and a click call it with the row. Buckets in `selected` stay highlighted and pressed for a screen reader, and the others dim. `dimmed` takes a function of the row and dims the columns it returns `true` for. Labels under a column dim with it.

The demo above draws a [`Chart.Rule`](/charts/series#rules) at the score of each pick:

```tsx
{picked.map((key, index) => (
    <ScoreChart.Rule key={key} value={scoreOf(key)} label={index === 0 ? 'A' : 'B'} dashed={index > 0} />
))}
```

## Compare two columns

A click pins column A. The column under the pointer or keyboard previews B until a second click pins it. The app keeps A, B and the preview from `onActiveXChange`, and passes both to `selected`. Point at another column:

<Demo src="charts/compare-columns" />

```tsx
const shown = reference === null ? null : ((preview !== reference ? preview : null) ?? candidate);

<ScoreChart.Root
    data={scores}
    x="key"
    group="model"
    rowLabel={(row) => `${row.model}, ${effortName(row.effort)}`}
    margin={{ top: 44, right: 16 }}
    selected={[reference, shown].filter((key) => key !== null)}
    onActivate={pick}
    onActiveXChange={(x) => setPreview(x === null ? null : String(x))}
>
    ...
    {reference !== null && <ScoreChart.Rule value={scoreOf(reference)} label="A" tone={{ color: 'var(--text-muted)' }} />}
    {shown !== null && <ScoreChart.Rule value={scoreOf(shown)} label="B" tone={{ color: 'var(--text-muted)' }} dashed />}
</ScoreChart.Root>
```

`rowLabel` gives the screen reader "Atlas 5, High" while the axis writes "H". To clear pins on Escape, listen for it on an element around the chart.

## Few wide columns

A few labeled columns need no value axis. `lines="ground"` draws only the ground, `rounded="end"` keeps columns flat on it, `headroom: 'none'` lets the tallest fill the plot, and the root's `format` writes the values:

<Demo src="charts/weekly-medians" />

```tsx
<Chart.Root data={weeks} x="start" label="Median time to a first review per week" height={140} y={{ headroom: 'none' }} format={formatDuration}>
    <Chart.Grid lines="ground" />
    <Chart.XAxis format={(start) => formatDay(start as number)} />
    <Chart.Bar value="median" label="Median" radius={4} rounded="end" minHeight={2} valueLabels valueLabelSize="xs" />
    <Chart.Tooltip />
</Chart.Root>
```

## Runs in a row

A column per run, colored by outcome. `value` reads a missed run as 0 and `minHeight` draws it as a stub. The tooltip sits in the top right corner, and `cursor="none"` lights no bucket:

<Demo src="charts/run-durations" />

```tsx
<Chart.Root data={runs} x="id" label="Duration of the latest runs" height={160} format={formatDuration} cursor="none">
    <Chart.Grid />
    <Chart.YAxis ticks={3} format={(ms) => `${formatNumber(ms / 1000)} s`} />
    <Chart.Bar value={(run) => run.duration ?? 0} label="Duration" tone={(run) => runTone(run.status)} radius={0} minHeight={3} />
    <Chart.Tooltip placement="top-right" />
</Chart.Root>
```

## A ranked row

A second `Chart.XAxis` writes a row of labels under the first, and `angle={-40}` slants them for long names:

<Demo src="charts/scores-ranked" />

```tsx
<ScoreChart.Root data={ranked} x="key" label="Scores, ranked" y={{ min: 0, max: 80 }} height={300} minBucketWidth={28}>
    <ScoreChart.Grid />
    <ScoreChart.YAxis ticks={4} />
    <ScoreChart.XAxis format={(key) => effortOf(key)} thin={false} />
    <ScoreChart.XAxis angle={-40} format={(key) => nameOf(key)} />
    <ScoreChart.Bar value="score" label="Intelligence" tone={(row) => ({ color: labColor(row.lab) })} />
    <ScoreChart.Tooltip />
</ScoreChart.Root>
```

The tooltip, live region and table name a bucket by every row, the lowest first ("Atlas 5, high"). `thin={false}` keeps every label. For many long names, use horizontal bars.

## Horizontal bars

`orientation="horizontal"` turns the buckets of a band scale into rows, with the name on the left and the bar running right. Lines of code per folder, with the median as a rule:

<Demo src="charts/lines-by-folder" />

```tsx
const FolderChart = createChart<FolderLines>();

<FolderChart.Root data={folders} x="path" orientation="horizontal" label="Lines of code per folder" format={formatNumber}>
    <FolderChart.Grid />
    <FolderChart.YAxis ticks={4} />
    <FolderChart.XAxis />
    <FolderChart.Bars stack>
        <FolderChart.Bar value="code" label="Code" />
        <FolderChart.Bar value="tests" label="Tests" valueLabels />
    </FolderChart.Bars>
    <FolderChart.Rule value={median} label="Median" dashed />
    <FolderChart.Tooltip total />
    <FolderChart.Legend />
    <FolderChart.Table />
</FolderChart.Root>
```

The x is still the bucket and the y the value, so every part keeps its name and props:

- The height is `rowHeight` pixels per row (32 by default) plus the axes, in place of `height` and `grow`.
- `Chart.XAxis` writes every name on the left, up to `maxWidth` (240 by default, at most 40% of the chart). Longer names get an ellipsis; the tooltip, live region and table read them whole.
- `Chart.YAxis` writes the values under the plot. `Chart.Grid` draws upright lines; `axis="x"` draws a line through every row.
- `Chart.Bar` keeps its props. `minHeight` is the least bar length and `columnWidth` the bar thickness.
- `valueLabels` writes the value past the bar's end. A stack writes its total once, through the `valueLabels` of its last part.
- `Chart.Rule` runs down through the rows.
- Up and Down move row by row, Home and End go to the ends. `group` adds gaps that Page Up and Page Down jump between; `Chart.GroupAxis` draws nothing.
- Lines, areas, points, markers and bands are left out, with a warning in development. On a `time` or `linear` scale, or with `rows="points"`, the chart stays vertical.

## Value labels

`valueLabels` on `Chart.Bar` writes each column's value over it, in the axis format or through a function: `valueLabels={(value, row) => row.summary}`. `valueLabelSize="xs"` writes them a size larger than the default `2xs`. Colliding labels stack upward. The root keeps room for one row of labels; set `top` in `margin` when they stack higher. The tooltip, live region and table carry the same numbers for screen readers.
