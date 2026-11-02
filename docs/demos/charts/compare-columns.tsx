import { useState } from 'react';
import { createChart, type ChartX } from '@adecore/charts';
import { formatNumber } from '@adecore/ui/format';
import { LAB_COLORS, scoresByModel, type ModelScore } from '../shared/chart-data.ts';

const ScoreChart = createChart<ModelScore>();
const scores = scoresByModel();
const EFFORTS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', max: 'Max' };
const SHORT: Record<string, string> = { low: 'L', medium: 'M', high: 'H', max: 'X' };

function scoreOf(key: string): number {
    return scores.find((row) => row.key === key)!.score;
}

function signed(value: number): string {
    return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatNumber(Math.abs(value))}`;
}

export default function CompareColumnsDemo() {
    const [reference, setReference] = useState<string | null>('Atlas 5:high');
    const [candidate, setCandidate] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    // A column under the pointer or the keyboard stands in for B until one is picked.
    const shown = reference === null ? null : ((preview !== reference ? preview : null) ?? candidate);

    const pick = (row: ModelScore): void => {
        if (reference === null || row.key === reference) {
            setReference(reference === null ? row.key : null);
            setCandidate(null);
        } else {
            setCandidate(row.key);
        }
    };

    return (
        <div className="flex w-full flex-col gap-2">
            <ScoreChart.Root
                data={scores}
                x="key"
                group="model"
                groupGap={20}
                rowLabel={(row) => `${row.model}, ${EFFORTS[row.effort]}`}
                label="Scores per model and effort, compared"
                y={{ min: 0, max: 80 }}
                height={240}
                minBucketWidth={28}
                margin={{ top: 44, right: 16 }}
                selected={[reference, shown].filter((key): key is string => key !== null)}
                onActivate={pick}
                onActiveXChange={(x: ChartX | null) => setPreview(x === null ? null : String(x))}
                className="w-full"
            >
                <ScoreChart.Grid dashed />
                <ScoreChart.YAxis ticks={4} />
                <ScoreChart.XAxis format={(key) => SHORT[String(key).split(':')[1]!]!} thin={false} />
                <ScoreChart.Bar
                    value="score"
                    label="Intelligence"
                    tone={(row) => ({ color: LAB_COLORS[row.lab]! })}
                    opacity={(_, indexInGroup, groupSize) => 0.6 + (indexInGroup / Math.max(groupSize - 1, 1)) * 0.4}
                    hoverOpacity={1}
                    dimOpacity={0.3}
                    columnWidth={(bucket) => Math.max(6, Math.min(44, Math.floor(bucket) - 4))}
                    radius={3}
                    valueLabels
                />
                {reference !== null && <ScoreChart.Rule value={scoreOf(reference)} label="A" tone={{ color: 'var(--text-muted)' }} />}
                {shown !== null && <ScoreChart.Rule value={scoreOf(shown)} label="B" tone={{ color: 'var(--text-muted)' }} dashed />}
                <ScoreChart.GroupAxis>{(group) => <span className="leading-tight font-medium text-text">{group.key}</span>}</ScoreChart.GroupAxis>
            </ScoreChart.Root>
            <p className="text-xs text-text-muted">
                {reference === null
                    ? 'Pick a column to compare against.'
                    : shown === null
                      ? `A: ${reference.replace(':', ', ')}. Point at another column for B.`
                      : `B against A: ${signed(scoreOf(shown) - scoreOf(reference))} points.`}
            </p>
        </div>
    );
}
