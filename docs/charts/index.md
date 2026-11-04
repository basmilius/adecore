# Charts

`@adecore/charts` draws charts as SVG on the theme of `@adecore/ui`: series as lines, areas and columns, a scatter of points, a heatmap, a timeline of spans and a sparkline. A chart takes its width from its container and is one tab stop that a screen reader reads bucket by bucket. The app hands it rows; the chart works out the scales, the ticks and the cursor.

<Demo src="charts/errors-per-hour" />

## What it does

- Draws series per bucket on a shared x axis of categories, moments or numbers, as lines, areas and columns side by side or stacked.
- Groups columns under a second row of labels, and plots points on two value axes with the frontier nothing beats.
- Marks moments, ranges and reference values, and names them in the tooltip.
- Measures the y axis to its widest label.
- Moves one cursor by pointer and keyboard, reads each bucket in a live region and shows every value as a table on request.
- Shares one cursor between charts, and lets the app draw its own shapes on the same scales.
- Colors series from the `--chart-1` to `--chart-6` palette of the theme, or from a status tone.

## What it leaves to the app

The package fetches nothing and holds no data. The app loads the rows, keeps them current and shows its own loading state; a chart without rows says "No data". Numbers and dates go through the formatters of `@adecore/ui`, so the format source of the app decides how they read.

## Where to next

- [Getting started](/charts/getting-started) installs the package, loads its words and draws a first chart.
- [Series chart](/charts/series), [Columns and groups](/charts/columns) and [Scatter and series legend](/charts/scatter) cover the parts of `Chart`.
- [Heatmap](/charts/heatmap), [Timeline](/charts/timeline) and [Sparkline](/charts/sparkline) cover the other charts.
- [Shared cursor](/charts/shared-cursor) and [useChart](/charts/use-chart) cover several charts at once and drawings of the app's own.
- [Keyboard and screen reader](/charts/keyboard) lists the keys and what a screen reader hears.
- [Reference](/charts/reference) lists every part and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/charts/LICENSE).
