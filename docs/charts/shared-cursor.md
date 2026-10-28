# Shared cursor

Charts inside a `Chart.Group` share one cursor. The group shares an x, not an index, so the data sets need not line up: each chart takes its own bucket at that moment. Errors per hour above, latency every 20 minutes below:

<Demo src="charts/shared-cursor" />

```tsx
<Chart.Group className="flex flex-col gap-6">
    <Chart.Root data={errors} x="at" xScale="time" label="Errors per hour" height={150}>
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.Area value="errors" label="Errors" tone="error" />
        <Chart.Tooltip />
    </Chart.Root>
    <Chart.Root data={latency} x="at" xScale="time" label="Latency, p95" height={170}>
        <Chart.Grid />
        <Chart.XAxis />
        <Chart.YAxis format={(value) => `${value} ms`} />
        <Chart.Line value="p95" label="p95" curve="monotone" />
        <Chart.Tooltip format={(value) => `${value} ms`} />
    </Chart.Root>
</Chart.Group>
```

Only the chart under the pointer or keyboard shows its tooltip.

The group also aligns the plots: the y axes on each side take the width of the widest, so a moment stands at the same pixel in every chart.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `shareCursor` | `boolean` | `true` | One cursor for every chart inside. |
| `alignAxes` | `boolean` | `true` | The y axes take the width of the widest. |
| `className`, `ref` | | | On the `<div>` it draws. |

The props are `ChartGroupProps`. A chart that controls its cursor with `activeX` stays out of the group's cursor. To keep the cursor in an app store, control each chart with `activeX` and `onActiveXChange` instead of a group.
