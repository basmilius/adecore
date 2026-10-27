# Columns and groups

`Chart.Bar` draws a column per bucket, on a `band` scale or on a `time` scale. Tokens per day, input and output stacked, with the total in the tooltip:

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

`Chart.Bars` holds the `Chart.Bar` that share the width of a bucket. Without `stack` they stand side by side, with `stack` they pile up in the order of the children, with 1px of ground between two segments. A `Chart.Bar` outside `Chart.Bars` stands beside the others outside it.

Columns stand on whole pixels. A column is never narrower than 2px, and by default takes 72% of its bucket, at most 56px, which leaves at least 1px of air to the next bucket. While the cursor is on a bucket, the columns of the others dim to 55%.

`tone` takes a tone, `{ color }`, or a function of the row for a color per column: `tone={(row) => runTone(row.status)}`. `opacity` is a function of the row, its index in its group and the size of the group, for columns that grow stronger inside one. The props are `ChartBarsProps` and `ChartBarProps`, and `ChartBarTone` is the type of `tone`.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `value`, `label` | | | Required. What the column reads, and its name in the tooltip, the legend and the table. |
| `tone` | `ChartBarTone` | the next chart color | |
| `opacity` | `(row, indexInGroup, groupSize) => number` | | |
| `hoverOpacity` | `number` | `0.55` | The other columns while the cursor is on a bucket; `1` leaves them be. |
| `dimOpacity` | `number` | `0.4` | A column the root dims, or one not picked while another is. Below 0.4 a column that is already light nearly vanishes in the dark theme. |
| `columnWidth` | `(bucket: number) => number` | | The pixels the columns of a bucket take together, at most the bucket. |
| `radius` | `number` | `2` | The corners of a column that stands alone, at most a quarter of its width. |
| `rounded` | `'all' \| 'end'` | `'all'` | Which corners `radius` rounds: all four, or only the end away from the ground, so the column stands flat on it. |
| `minHeight` | `number` | | The least height of a column that stands alone, in pixels. A zero gets it too, so a run that took no time still shows as a stub; a missing value draws nothing. Pass `?? 0` in `value` where a missing value should be a stub as well. |
| `animate` | `boolean` | `false` | The columns grow from the ground once, when they first draw. Not for a person who asks for reduced motion. |
| `valueLabels` | `boolean \| (value, row, index) => string` | | Writes each column's value over it, see [value labels](#value-labels). |
| `valueLabelSize` | `'2xs' \| 'xs'` | `'2xs'` | The type size of the value labels. |

## Columns over time

On a `time` scale each bucket lasts one `step` from its x, and its columns stand in that slot. A marker or a band at any moment then lands where it happened, between the columns or across them, and a row that is missing leaves its slot empty. Runs of a job per hour, the failed ones on top in the error tone, with their sum in the tooltip:

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

`step` defaults to the smallest distance between two rows; give it when the first rows may be missing. Columns on a time scale take a `step`: with one row there is no distance to learn it from, and the columns stay away, with a warning outside production. A `band` scale of days or hours draws the same columns, but there a marker needs the key of a bucket.

## Groups

`group` on the root puts the buckets into groups by a key, in the order of `data`, with a gap of `groupGap` pixels between them (16 by default) and half of one at both ends. Each row is one bucket, so a group holds as many columns as it has rows. Scores per model and effort, two to four efforts per model, on a dashed grid, with wider columns that stay as they are while the cursor is elsewhere:

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

`Chart.GroupAxis` is a second row of labels under the x axis, one per group and centered under it. It is HTML, so a mark or a logo fits. A label takes the width of its columns plus half the gap on each side before it wraps. Its `children` is a function of the group (`ChartBucketGroup`: its `key`, its `label`, its `rows` and the index of its `first` and `last` bucket); the props are `ChartGroupAxisProps`.

The arrow keys keep moving column by column, across the edges of the groups, and Page Up and Page Down jump to the first column of the previous or the next group. The live region names the group first ("Atlas 5, high, Intelligence 71").

The key of a group is its identity, which need not be what a person reads, such as the id of a model. `groupLabel` on the root reads the name from the rows, as a key or a function: `groupLabel="modelName"`. The tooltip, the live region and the table read it, and `Chart.GroupAxis` hands it to its children as `label`.

`minBucketWidth` is the narrowest a bucket may be. Below it the plot grows wider than its box and scrolls sideways, while the y axis stays in place. What hangs out of the first buckets, such as a value label or a slanted name, may run over the y axis until the plot scrolls.

## Picking columns

With `onActivate`, the buckets become pressable: Enter, Space and a click call it with the row. The buckets in `selected` stay highlighted, are pressed for a screen reader, and the other columns dim. What a pick means, such as a reference to compare against, stays with the app. `dimmed` takes a function of the row and dims every column the app does not want in focus, such as the other models while one is highlighted. The labels under a column follow it: they dim with it, at its `dimOpacity`, and are written in `--text` while it is under the cursor or picked.

The demo above draws a [`Chart.Rule`](/charts/series#rules) at the score of each pick, A solid and B dashed, so the other columns read against them:

```tsx
{picked.map((key, index) => (
    <ScoreChart.Rule key={key} value={scoreOf(key)} label={index === 0 ? 'A' : 'B'} dashed={index > 0} />
))}
```

## Compare two columns

A click pins column A. The column under the pointer or the keyboard then stands in for B, with a dashed rule at its value, until a second click pins it. `onActiveXChange` hears the key of every bucket the pointer or the keyboard moves to, and `null` when the pointer leaves with no keyboard place to go back to; the app keeps A, B and the preview, and picks both through `selected`. Here A is pinned on Atlas 5, high; point at another column:

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

`rowLabel` is what a screen reader hears for a column, "Atlas 5, High", while the axis writes "H". In a dialog, `surface="raised"` draws the halo of the rule labels in the dialog's surface. Escape clears the cursor first and stops there; an app that clears its pins on Escape too listens for it on an element around the chart.

## Few wide columns

A handful of columns, each with its value over it, needs no value axis. `lines="ground"` on `Chart.Grid` draws only the line they stand on, `rounded="end"` rounds the top of a column and keeps it flat on that line, `headroom: 'none'` lets the tallest fill the plot, and `minHeight` keeps a short one in sight. The root's `format` writes the values in the labels, the tooltip and the table without a y axis:

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

A column per run of a job, in the color of how it ended. A missed run took no time, so `value` reads it as 0 and `minHeight` keeps it as a stub. The card stays in the top right corner of the plot and moves to the left while the pointer is on a column under it, and `cursor="none"` lights no bucket, so only the other columns dim:

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

Without `group`, every column stands in one row. A second `Chart.XAxis` writes a row of labels under the first, and `angle={-40}` slants them, for long names under every column:

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

The rows stack in the order of the children. The tooltip, the live region and the table name a bucket by every row, the lowest first ("Atlas 5, high"). A row of a band scale leaves labels out where they would overlap; `thin={false}` writes one under every column. For more than a handful of long names, turn the chart on its side.

## Horizontal bars

`orientation="horizontal"` on the root turns the buckets of a band scale into rows: the name on the left, the bar running to the right, its value past its end. It suits a ranked list of categories with long names, such as folders, packages or models. Lines of code per folder, code and tests stacked, with the median of the totals as a rule:

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

The x is still the bucket and the y still the value, so every part keeps its name and its props:

- The height follows the rows: `rowHeight` pixels each (32 by default) and the room of the axes, in place of `height` and `grow`. A list of five and a list of thirty both read without scrolling inside the chart.
- `Chart.XAxis` writes the name of every row on the left, never thinned. Its column is as wide as the widest name, up to `maxWidth` (240 by default) and never more than 40% of the chart; a longer name is cut short with an ellipsis, and the tooltip, the live region and the table read it whole. The pointer takes a row over its name as well as over its bar.
- `Chart.YAxis` writes the values under the plot, and its `title` above the plot where the values start. `Chart.Grid` draws its lines upright on the ticks; `axis="x"` draws a line through every row.
- `Chart.Bar` keeps `tone`, `opacity`, `dimOpacity`, `hoverOpacity`, `radius`, `rounded`, `minHeight` (the least length of a bar), `animate` and `columnWidth` (the thickness of the bars, from the height of a row). Bars outside a stack stand under each other in their row.
- `valueLabels` writes a value past the end of its bar in `text-xs`, and the root keeps room right of the plot for the widest. A stack writes one value past its end: its total, written by its last part with `valueLabels`, through that part's function when it has one.
- `Chart.Rule` is a line down through the rows, named above the plot on the side that has the room.
- Up and Down move the cursor row by row, Home and End go to the first and the last, and Left and Right are left to the page. `group` puts a gap between runs of rows, and Page Up and Page Down jump between them; `Chart.GroupAxis` draws nothing here.
- Lines, areas, points, markers and bands have no place across rows: a horizontal chart leaves them out, with a warning outside production. On a `time` or `linear` scale, or with `rows="points"`, the chart stays vertical.

## Value labels

`valueLabels` on `Chart.Bar` writes each column's value over it, as the y axis writes values, or through a function of the value, the row and its index: `valueLabels={(value, row) => row.summary}`. The labels are in `text-2xs`, 10px over their column, which suits a dense row; `valueLabelSize="xs"` writes them a size larger, for a few wide columns that carry no axis. Where two labels would collide by their measured width, the later one moves up over the other, with a thin line down to its column once it has moved a row. A label dims with its column when the column is dimmed or another is picked, and stays as it is while the cursor is elsewhere. The scores per model above write theirs.

The root keeps 24px above the plot for one row of labels over the tallest column. Labels that move up further need more: set `top` in `margin`. The labels are drawn for the eye; the tooltip, the live region and the table carry the same numbers for a screen reader.
