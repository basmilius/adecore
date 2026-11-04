# Reference

```tsx
import { Chart, Heatmap, SeriesLegend, Sparkline, Timeline, createChart, useChart } from '@adecore/charts';
```

## Parts

`Chart.Root` owns the data, the scales, the cursor and the keyboard. Each part inside it draws one layer, in the order of the children: the grid first, then bands, series and markers. `Chart.Tooltip`, `Chart.Legend` and `Chart.Table` take their own places whatever their order.

| Part | Draws |
| --- | --- |
| [`Chart.Root`](/charts/series#chart-root) | The box. Its width follows the container; its height is fixed. |
| [`Chart.Grid`](/charts/series#grid-and-axes) | Gridlines on the ticks of the value axis, or of the x axis, or both. |
| [`Chart.XAxis`, `Chart.YAxis`](/charts/series#grid-and-axes) | Ticks and labels. The y axis measures its widest label. |
| [`Chart.GroupAxis`](/charts/columns#groups) | A second row of labels, one per group of columns. |
| [`Chart.Line`, `Chart.Area`](/charts/series#lines-and-areas) | A line, and a line with its area filled. |
| [`Chart.Bars`, `Chart.Bar`](/charts/columns) | Columns, side by side or stacked. |
| [`Chart.Point`](/charts/scatter#points) | A dot per value; on a scatter the points the cursor moves between. |
| [`Chart.Frontier`](/charts/scatter#frontier) | A band through the points nothing beats on both axes. |
| [`Chart.EndLabels`](/charts/scatter#end-labels) | A label at the end of each series of a scatter. |
| [`Chart.Marker`, `Chart.Band`](/charts/series#markers-and-bands) | A moment and a range, named in the tooltip. |
| [`Chart.Rule`](/charts/series#rules) | A line at a value, such as a reference, above the series. |
| [`Chart.Tooltip`](/charts/series#tooltip-legend-and-table) | The card at the cursor. |
| [`Chart.Legend`](/charts/series#tooltip-legend-and-table) | The series with their color. |
| [`Chart.Table`](/charts/series#tooltip-legend-and-table) | A toggle that shows every value as a table. |
| [`Chart.Layer`](/charts/use-chart) | A group in the plot for a drawing of the app's own. |
| [`Chart.Group`](/charts/shared-cursor) | Charts that share one cursor. |

A [timeline](/charts/timeline) has parts of its own: `Timeline.Root`, `Timeline.Legend`, `Timeline.Axis`, `Timeline.Moment` and `Timeline.Rows`.

## Other components

| Component | |
| --- | --- |
| [`Heatmap`](/charts/heatmap) | A grid of cells shaded by value, such as events by weekday and hour. |
| [`Sparkline`](/charts/sparkline) | A small line or row of columns without axes, for a list row or a tile. |
| [`SeriesLegend`](/charts/scatter#series-legend) | A list of many series beside a chart, with search and toggles. It reports what is off; the app decides what hiding means. |

## Exports

Every name `@adecore/charts` exports, read from its source. Anything not listed is internal. The package has no other entry point and no stylesheet.

<ExportTable entry="@adecore/charts" />
