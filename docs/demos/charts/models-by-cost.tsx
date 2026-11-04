import { createChart, SeriesLegend } from '@adecore/charts';
import { Segmented } from '@adecore/ui';
import { useState } from 'react';
import { costsByModel, formatCost, LAB_COLORS, MODEL_COLORS, type ModelCost } from '../shared/chart-data.ts';

const CostChart = createChart<ModelCost>();
const points = costsByModel();
const models = [...new Set(points.map((point) => point.model))];
const LABS = Object.keys(LAB_COLORS);

/* A stand-in for a lab's logo: its initial in the color of the model. */
function LabMark({ lab }: { lab: string }) {
    return (
        <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-current text-2xs font-semibold">
            {lab[0]}
        </span>
    );
}

export default function ModelsByCostDemo() {
    const [scale, setScale] = useState<'log' | 'linear'>('log');
    const [hidden, setHidden] = useState<string[]>([]);
    const [highlighted, setHighlighted] = useState<string | null>(null);
    const [picked, setPicked] = useState<string[]>(['Atlas 5:high']);
    const drawn = points.filter((point) => !hidden.includes(point.model));

    const pick = (row: ModelCost): void =>
        setPicked((current) => (current.includes(row.key) ? current.filter((key) => key !== row.key) : [...current.slice(-1), row.key]));

    return (
        <div className="flex w-full flex-wrap gap-6">
            <div className="flex min-w-0 grow basis-96 flex-col gap-2">
                <Segmented<'log' | 'linear'>
                    value={scale}
                    onValueChange={setScale}
                    label="Scale"
                    options={[
                        { id: 'linear', label: 'Linear' },
                        { id: 'log', label: 'Log' }
                    ]}
                    className="self-end"
                />
                <CostChart.Root
                    data={drawn}
                    rows="points"
                    x="cost"
                    xScale={scale}
                    xOptions={scale === 'linear' ? { min: 0 } : undefined}
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
                    <CostChart.XAxis title="Cost per task" format={(value) => formatCost(value as number)} />
                    <CostChart.Frontier />
                    <CostChart.Line value="score" label="Intelligence" tone={(row) => ({ color: MODEL_COLORS[row.model]! })} />
                    <CostChart.Point value="score" label="Intelligence" tone={(row) => ({ color: MODEL_COLORS[row.model]! })} />
                    <CostChart.EndLabels>
                        {(series) => (
                            <>
                                <LabMark lab={series.rows[0]!.lab} />
                                <span className="truncate">{series.label}</span>
                            </>
                        )}
                    </CostChart.EndLabels>
                </CostChart.Root>
            </div>
            <SeriesLegend
                className="w-56 shrink-0"
                label="Models"
                search="Find models"
                items={models.map((model) => {
                    const lab = points.find((point) => point.model === model)!.lab;

                    return { key: model, label: model, name: `${lab} ${model}`, group: lab, color: MODEL_COLORS[model] };
                })}
                groups={LABS.map((lab) => ({ key: lab, label: lab }))}
                hidden={hidden}
                onHiddenChange={setHidden}
                highlighted={highlighted}
                onHighlightedChange={setHighlighted}
                mark={(item) => <LabMark lab={item.group!} />}
            />
        </div>
    );
}
