# Scatter and series legend

With `rows="points"`, `Chart.Root` draws a scatter. Every row is a point at its x and value, `group` sorts points into series, and `Chart.Line` connects each series in data order. The cursor, keyboard and `onActivate` work per point. Models by intelligence against cost, on a log axis, with a frontier, end labels and a legend:

<Demo src="charts/models-by-cost" />

```tsx
const CostChart = createChart<ModelCost>();

<CostChart.Root
    data={points.filter((point) => !hidden.includes(point.model))}
    rows="points"
    x="cost"
    xScale="log"
    rowKey="key"
    rowLabel="effort"
    group="model"
    y={{ step: 10 }}
    label="Intelligence against cost per task"
    height={320}
    margin={{ top: 34 }}
    selected={picked}
    onActivate={pick}
    dimmed={(row) => highlighted !== null && row.model !== highlighted}
>
    <CostChart.Grid dashed />
    <CostChart.YAxis title="Intelligence" />
    <CostChart.XAxis title="Cost per task" format={formatCost} />
    <CostChart.Frontier />
    <CostChart.Line value="score" label="Intelligence" tone={(row) => ({ color: modelColor(row.model) })} />
    <CostChart.Point value="score" label="Intelligence" tone={(row) => ({ color: modelColor(row.model) })} />
    <CostChart.EndLabels>
        {(series) => (
            <>
                <LabMark lab={series.rows[0].lab} />
                <span className="truncate">{series.label}</span>
            </>
        )}
    </CostChart.EndLabels>
</CostChart.Root>
```

## Points

`rows` takes a `ChartRows`: `'buckets'` (the default) or `'points'`. On a point chart:

- Each row stands at its x and the value of the first `Chart.Point` or `Chart.Line`. A row without an x or value gets no point and breaks its line.
- `group` sorts rows into series, in order of first appearance, and `groupLabel` names them. Without `group`, all points are one series.
- `rowKey` identifies a row for `selected`, `activeX` and `onActiveXChange` (its index by default). `rowLabel` names a point within its series.
- A linear value axis does not include zero. `step: 10` in `y` ticks every 10, on column charts too.
- `xScale` is `'linear'`, `'log'` or `'time'`. `xOptions` (a `ChartXOptions`) fixes the ends of a linear axis, such as `{ min: 0 }`. On a `log` axis it widens the range to whole decades: `{ min: 0.05, max: 5 }` runs from 0.01 to 10. Log ticks fall on decades, thinned evenly when they do not fit.

`Chart.Point` draws a dot per point. Without a `tone`, each series takes the next chart color; `tone` also takes a function of the row. The point under the cursor grows, and picked and keyboard points get a ring. `Chart.Line` colors each series by its first row. The props are `ChartPointProps`.

`dimmed` dims a point. A series with all points dimmed dims its line and end label too, so dimming the others brings one series forward.

## Cursor, keyboard and picks

The pointer takes the nearest point within 16px. Dashed guides run from the point to both axes, with its x and value written on them; picked points keep their guides. `onActiveXChange` receives the point's key, or `null`.

The plot is one tab stop. Left and Right move along a series, Up and Down to the same place in the previous or next series, Home and End to the series ends, and Escape clears. A point reads as "Atlas 5, high, Cost per task $0.74, Intelligence 71".

With `onActivate`, every point is a `role="button"` with `aria-pressed`: Enter, Space and a click call it. `selected` takes the picked keys.

`Chart.Tooltip` works per point. `Chart.Legend` lists the series. `Chart.Table` gives a point's label its own column and leaves out rows without an x or value.

## Frontier

`Chart.Frontier` draws a soft band through the points no other point beats on both axes. By default a lower x and a higher value are better. `lowerX={false}` flips the x, `higherY={false}` the value. `width` is the band width in pixels (14) and `tone` its color (`--border`). Put it before the lines. The props are `ChartFrontierProps`.

## End labels

`Chart.EndLabels` writes a label right of the plot at the last point of each series, with a line back to the point. Labels push apart to stay readable. The plot gives up `width` pixels on the right for them (118, or 156 above 750px).

Its children get a `ChartPointSeries` (`key`, `label`, `rows` and `color`) and return the label content, which takes the series color as `currentColor`. Without children it writes the series label. The props are `ChartEndLabelsProps`.

## Series legend

`SeriesLegend` lists many series beside a chart, with a search, group toggles, a toggle per series and a highlight on hover or focus. It needs no `Chart.Root`. It only reports: `hidden`/`onHiddenChange` hold the keys that are off, and `highlighted`/`onHighlightedChange` the one under the pointer. The app decides what hiding means, such as leaving rows out of `data`.

```tsx
<SeriesLegend
    label="Models"
    search="Find models"
    items={models.map((model) => ({ key: model.id, label: model.shortName, name: model.name, group: model.lab, color: model.color }))}
    groups={labs.map((lab) => ({ key: lab.id, label: lab.name }))}
    hidden={hidden}
    onHiddenChange={setHidden}
    highlighted={highlighted}
    onHighlightedChange={setHighlighted}
    mark={(item) => <LabLogo lab={item.group} />}
/>
```

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `items`, `label` | `SeriesLegendItem[]`, `string` | | Required. The series, and the list name for a screen reader. |
| `hidden`, `onHiddenChange` | `string[]` | | Required. The keys of the series that are off. |
| `highlighted`, `onHighlightedChange` | `string \| null` | | The series under the pointer or focus. Hidden series are never highlighted. |
| `groups` | `SeriesLegendGroup[]` | | The groups in order, each with a toggle for all its series. Items in no listed group are left out. |
| `mark` | `(item) => ReactNode` | | Drawn before the name in the item's color. |
| `search` | `string \| false` | "Search" | The search placeholder and name; `false` drops it. |
| `query`, `onQueryChange` | `string` | | Controls the search. |
| `empty` | `string` | "Nothing matches." | Shown when the search finds nothing. |
| `size` | `'sm' \| 'md'` | `'sm'` | Row height: 28px, or 36px for touch. |

A `SeriesLegendItem` has a `key` and a `label`, and optionally a `name` (the full name for screen readers, the hint and search), a `group`, a `color`, `disabled`, and a `status` explaining why it shows less ("Turned off"). The props are `SeriesLegendProps`.
