# useChart

`useChart()` reads the surrounding chart's plot, scales, data and cursor. With `Chart.Layer`, a `<g>` in the plot, an app draws its own shapes on the same axes. The demo draws a budget line by hand; [`Chart.Rule`](/charts/series#rules) is the ready-made version.

<Demo src="charts/use-chart" />

```tsx
function Budget() {
    const { plot, y } = useChart();
    const pixel = y(300);
    if (pixel === null) {
        return null;
    }
    const top = Math.round(pixel) + 0.5;
    return <line x1={plot.left} x2={plot.right} y1={top} y2={top} stroke="currentColor" strokeDasharray="6 4" />;
}

<Chart.Root data={latency} x="at" xScale="time" y={{ min: 0, max: 400 }} label="Latency, p95, against its budget">
    <Chart.Line value="p95" label="p95" />
    <Chart.Layer>
        <Budget />
    </Chart.Layer>
</Chart.Root>
```

`useChart<Row>()` returns a `ChartApi`:

| Field | |
| --- | --- |
| `plot` | The plot as a `ChartRect` (`left`, `top`, `right`, `bottom`, `width`, `height`), in `Chart.Layer` coordinates. |
| `data` | The rows of the root. |
| `x(value)` | The pixel of an x, the bucket center on a band scale. `null` for an unknown x. |
| `y(value)` | The pixel of a value, `null` for one a log scale cannot show. |
| `yTicks` | The ticks of the value axis. |
| `bandwidth` | The bucket width on a band scale, 0 on a continuous one. |
| `activeIndex`, `activeRow` | The bucket under the cursor, or `null`. |
| `setActiveX(x)` | Moves the cursor, or clears it with `null`. |

Round a pixel and add 0.5 for a sharp 1px line. A layer draws in the order of the children. `Chart.Layer` takes `className` and `ref` (`ChartLayerProps`). `useChart` throws outside a `Chart.Root`.
