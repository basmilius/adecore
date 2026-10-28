# @adecore/charts

Charts in the theme of `@adecore/ui`: series as lines, areas and columns, a [scatter](/charts/scatter) of points, a sparkline, and a [heatmap](/charts/heatmap). A chart takes its width from its container and is one tab stop that a screen reader reads bucket by bucket.

```tsx
import { Chart, Heatmap, SeriesLegend, Sparkline, createChart, useChart } from '@adecore/charts';
```

<Demo src="charts/errors-per-hour" />

## Install

`@adecore/ui`, React 19, `i18next` and `react-i18next` are peer dependencies. Let Tailwind scan the package next to `@adecore/ui`:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";
@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/charts/dist";
```

The words live in a `charts` namespace in English and Dutch. Add them to the app's i18next:

```ts
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from '@adecore/charts';

for (const [language, words] of Object.entries(CHARTS_RESOURCES)) {
    i18n.addResourceBundle(language, CHARTS_NAMESPACE, words);
}
```

## How a chart is built

`Chart.Root` owns the data, scales, cursor and keyboard. Each part inside it draws one layer, in the order of the children, so put the grid first, then bands, series and markers. `Chart.Tooltip`, `Chart.Legend` and `Chart.Table` take their own places whatever their order.

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

For the spans of a trace, use [`Timeline`](/charts/timeline).

## Colors

A series takes a `tone`: a status tone of the theme (`accent`, `error`, `needsYou`, `idle`, `running`, `muted`) or `{ color }` with any CSS value. Without a tone, series take `--chart-1` to `--chart-6` in order, the [chart series of the theme](/ui/guide/theme#chart-series).

## Types

JSX cannot check `value="errors"` against the row type. `createChart<Row>()` returns `Chart` typed as a `TypedChart`, with `x`, `group` and `value` as keys or accessors of `Row`.

```tsx
const UsageChart = createChart<UsageDay>();

<UsageChart.Root data={days} x="day" label="Tokens per day">
    <UsageChart.Bar value="input" label="Input" />
</UsageChart.Root>
```

The plain `Chart` takes any key and warns in development when the first row lacks it.

## Keyboard and screen reader

The plot is one tab stop, a `group` with the role description "chart" and `label` as its name.

| Key | Moves the cursor |
| --- | --- |
| Arrow Left, Arrow Right | To the previous or the next bucket |
| Home, End | To the first or the last bucket |
| Page Up, Page Down | To the first bucket of the previous or the next group |
| Escape | Clears it |
| Enter, Space | Picks the bucket, with `onActivate` |

A scatter moves between points instead; see [cursor, keyboard and picks](/charts/scatter#cursor-keyboard-and-picks).

The pointer and the keyboard keep separate places. When the pointer leaves, the cursor returns to the keyboard's bucket.

A polite live region reads each bucket the keyboard reaches ("14:00, Errors 12, Warnings 3"). With `onActivate`, every bucket is a button with that name instead, and the live region stays quiet. `Chart.Table` makes every value readable without the cursor.

The Escape that clears the cursor stops at the chart, so a surrounding dialog stays open until a second Escape.

A decorative chart takes `interactive={false}`: an image named by `label`, with no tab stop, keys or live region. The pointer still moves the cursor and tooltip.

## Empty and loading

A chart without data says "No data". Loading state stays with the app.
