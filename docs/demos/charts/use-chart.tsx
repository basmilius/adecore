import { Chart, useChart } from '@adecore/charts';
import { latency } from '../shared/chart-data.ts';

const p95 = latency();
const BUDGET = 300;

/* A latency budget across the plot, drawn by the app on the chart's own scale. */
function Budget() {
    const { plot, y } = useChart();
    const pixel = y(BUDGET);

    if (pixel === null) {
        return null;
    }

    const top = Math.round(pixel) + 0.5;

    return (
        <g className="text-status-error">
            <line x1={plot.left} x2={plot.right} y1={top} y2={top} stroke="currentColor" strokeDasharray="6 4" />
            <text x={plot.right} y={top - 6} textAnchor="end" className="fill-current text-xs">
                Budget {BUDGET} ms
            </text>
        </g>
    );
}

export default function UseChartDemo() {
    return (
        <Chart.Root data={p95} x="at" xScale="time" y={{ min: 0, max: 400 }} label="Latency, p95, against its budget" height={200} className="w-full">
            <Chart.Grid />
            <Chart.XAxis />
            <Chart.YAxis format={(value) => `${value} ms`} />
            <Chart.Line value="p95" label="p95" curve="monotone" />
            <Chart.Layer>
                <Budget />
            </Chart.Layer>
            <Chart.Tooltip format={(value) => `${value} ms`} />
        </Chart.Root>
    );
}
