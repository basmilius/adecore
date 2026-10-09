import { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UiProps } from '@adecore/intelligent-ui';
import { SegmentBar, useMeasuredWidth } from '@adecore/ui';
import { formatRounded } from '@adecore/ui/format';
import { niceCeiling, UI_CHART_ROWS, uiChartData, type UiChartData } from '../chart-data';
import type { UiRendererProps } from '../render-context';
import { UiFallbackPart } from '../UiFallbackPart';

type ChartKind = UiProps<'Chart'>['kind'];

const HEIGHT = 160;
const HBAR_ROW = 24;
const STACKED_ROW = 28;
const AXIS_WIDTH = 44;
const PLOT_TOP = 8;
const LABEL_ROOM = 20;
/* The narrowest band a category label is written under; narrower bands skip labels. */
const LABEL_BAND = 56;
/* Points get a dot up to this many categories; more would crowd the line. */
const DOTS_UP_TO = 30;
const GROW = 'transition-[scale,opacity] duration-400 ease-out motion-reduce:transition-none';

function seriesColor(index: number): string {
    return `var(--chart-${index + 1})`;
}

function valueText(value: number | null, unit: string | undefined): string {
    if (value === null) {
        return '';
    }
    const text = formatRounded(value, 2);
    return unit === undefined || unit === '' ? text : unit === '%' ? `${text}%` : `${text} ${unit}`;
}

/* The height a chart will take, which its place holds while the node streams. */
function chartHeight(kind: ChartKind, rows: number): number {
    const count = Math.max(1, Math.min(rows, UI_CHART_ROWS));
    return kind === 'hbar' ? count * HBAR_ROW : kind === 'stacked' ? count * STACKED_ROW : HEIGHT;
}

/* One sentence with the main point, which a screen reader hears in place of the drawing. */
function chartSummary(chart: UiChartData, unit: string | undefined, t: TFunction<'agent-chat'>): string {
    let top: { label: string; series: string; value: number } | null = null;
    for (const series of chart.series) {
        for (let i = 0; i < series.values.length; i++) {
            const value = series.values[i];
            if (value !== null && value !== undefined && (top === null || value > top.value)) {
                top = { label: chart.labels[i] ?? '', series: series.key, value };
            }
        }
    }
    if (top === null) {
        return t('blocks.chart.values');
    }
    return chart.series.length > 1
        ? t('blocks.chart.summarySeries', { count: chart.labels.length, series: top.series, label: top.label, value: valueText(top.value, unit) })
        : t('blocks.chart.summary', { count: chart.labels.length, label: top.label, value: valueText(top.value, unit) });
}

function Legend({ chart }: { chart: UiChartData }) {
    return (
        <div aria-hidden className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            {chart.series.map((series, index) => (
                <span key={series.key} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm" style={{ backgroundColor: seriesColor(index) }} />
                    {series.key}
                </span>
            ))}
        </div>
    );
}

/* The numbers behind the drawing, for a screen reader. */
function ValuesTable({ chart, unit }: { chart: UiChartData; unit: string | undefined }) {
    const { t } = useTranslation('agent-chat');
    return (
        <table className="sr-only">
            <caption>{t('blocks.chart.values')}</caption>
            <thead>
                <tr>
                    <td />
                    {chart.series.map((series) => (
                        <th key={series.key} scope="col">
                            {series.key}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {chart.labels.map((label, index) => (
                    <tr key={index}>
                        <th scope="row">{label}</th>
                        {chart.series.map((series) => (
                            <td key={series.key}>{valueText(series.values[index] ?? null, unit)}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/* The values of one category beside the pointer. */
function Readout({ chart, index, left, unit }: { chart: UiChartData; index: number; left: number; unit: string | undefined }) {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-1 flex -translate-x-1/2 flex-col gap-0.5 rounded-md bg-surface-raised px-2 py-1 text-xs whitespace-nowrap shadow-raised"
            style={{ left }}
        >
            <span className="font-medium text-text">{chart.labels[index]}</span>
            {chart.series.map((series, at) => (
                <span key={series.key} className="flex items-center gap-1.5 text-text-muted tabular-nums">
                    <span className="size-2 rounded-sm" style={{ backgroundColor: seriesColor(at) }} />
                    {chart.series.length > 1 && <span>{series.key}</span>}
                    <span className="text-text">{valueText(series.values[index] ?? null, unit)}</span>
                </span>
            ))}
        </div>
    );
}

/* Bars and lines over a value axis, in SVG at the measured width. */
function VerticalChart({ chart, kind, unit, width }: { chart: UiChartData; kind: 'bar' | 'line'; unit: string | undefined; width: number }) {
    const [hover, setHover] = useState<number | null>(null);
    const low = chart.min < 0 ? -niceCeiling(-chart.min) : 0;
    const high = chart.max > 0 ? niceCeiling(chart.max) : low === 0 ? 1 : 0;
    const plotWidth = Math.max(0, width - AXIS_WIDTH);
    const plotHeight = HEIGHT - PLOT_TOP - LABEL_ROOM;
    const band = plotWidth / chart.labels.length;
    const y = (value: number): number => Math.round(PLOT_TOP + ((high - value) / (high - low)) * plotHeight);
    const baseline = y(0);
    const ticks = low === 0 ? [0, high / 2, high] : [low, 0, high];
    const labelEvery = Math.max(1, Math.ceil(LABEL_BAND / Math.max(1, band)));
    const center = (index: number): number => Math.round(AXIS_WIDTH + band * index + band / 2);
    const gap = band * 0.2;
    const barWidth = Math.max(1, (band - gap) / chart.series.length);

    const segments = (values: (number | null)[]): string =>
        values
            .map((value, index) => (value === null ? null : `${center(index)} ${y(value)}`))
            .reduce<string[]>((paths, point, index, all) => {
                if (point !== null) {
                    paths.push(`${index === 0 || all[index - 1] === null ? 'M' : 'L'}${point}`);
                }
                return paths;
            }, [])
            .join(' ');

    return (
        <>
            <svg width={width} height={HEIGHT} aria-hidden className="block overflow-visible" onPointerLeave={() => setHover(null)}>
                {hover !== null && (
                    <rect x={Math.round(AXIS_WIDTH + band * hover)} y={PLOT_TOP} width={Math.round(band)} height={plotHeight} className="fill-surface-hover" />
                )}
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            x1={AXIS_WIDTH}
                            x2={width}
                            y1={y(tick)}
                            y2={y(tick)}
                            className={tick === 0 ? 'stroke-border' : 'stroke-border-soft'}
                            shapeRendering="crispEdges"
                        />
                        <text x={AXIS_WIDTH - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-text-faint text-xs tabular-nums">
                            {valueText(tick, unit)}
                        </text>
                    </g>
                ))}
                {chart.labels.map((label, index) =>
                    index % labelEvery === 0 ? (
                        <text key={index} x={center(index)} y={HEIGHT - 4} textAnchor="middle" className="fill-text-faint text-xs">
                            {label}
                        </text>
                    ) : null
                )}
                {kind === 'bar' ? (
                    <g className={clsx(GROW, 'starting:scale-y-0')} style={{ transformOrigin: `0px ${baseline}px` }}>
                        {chart.series.map((series, at) =>
                            series.values.map((value, index) =>
                                value === null ? null : (
                                    <rect
                                        key={`${series.key}:${index}`}
                                        x={Math.round(AXIS_WIDTH + band * index + gap / 2 + barWidth * at)}
                                        y={Math.min(y(value), baseline)}
                                        width={Math.max(1, Math.round(barWidth) - 1)}
                                        height={Math.abs(y(value) - baseline)}
                                        rx={2}
                                        style={{ fill: seriesColor(at) }}
                                    />
                                )
                            )
                        )}
                    </g>
                ) : (
                    <g className={clsx(GROW, 'starting:opacity-0')}>
                        {chart.series.map((series, at) => (
                            <g key={series.key} style={{ color: seriesColor(at) }}>
                                <path
                                    d={segments(series.values)}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                                {chart.labels.length <= DOTS_UP_TO &&
                                    series.values.map((value, index) =>
                                        value === null ? null : <circle key={index} cx={center(index)} cy={y(value)} r={3} fill="currentColor" />
                                    )}
                            </g>
                        ))}
                    </g>
                )}
                {chart.labels.map((_, index) => (
                    <rect
                        key={index}
                        x={Math.round(AXIS_WIDTH + band * index)}
                        y={0}
                        width={Math.max(1, Math.round(band))}
                        height={HEIGHT}
                        fill="transparent"
                        onPointerEnter={() => setHover(index)}
                    />
                ))}
            </svg>
            {hover !== null && <Readout chart={chart} index={hover} unit={unit} left={Math.min(Math.max(center(hover), 64), Math.max(64, width - 64))} />}
        </>
    );
}

/* A row of 24px per category, its label beside the bars. */
function HorizontalChart({ chart, unit }: { chart: UiChartData; unit: string | undefined }) {
    // Bars grow right from zero only, so a chart of only negative values has no length to share and keeps a unit scale.
    const high = niceCeiling(chart.max) || 1;
    const single = chart.series.length === 1;
    return (
        <div aria-hidden className="flex flex-col">
            {chart.labels.map((label, index) => (
                <div key={index} className="flex h-6 items-center gap-2 text-xs">
                    <span className="w-2/5 max-w-36 shrink-0 truncate text-text-muted">{label}</span>
                    <span className="flex min-w-0 grow flex-col justify-center gap-px">
                        {chart.series.map((series, at) => (
                            <span
                                key={series.key}
                                className={clsx(GROW, 'block origin-left rounded-sm starting:scale-x-0', single ? 'h-3' : 'h-1')}
                                style={{ width: `${(Math.max(0, series.values[index] ?? 0) / high) * 100}%`, backgroundColor: seriesColor(at) }}
                            />
                        ))}
                    </span>
                    {single && (
                        <span className="w-16 shrink-0 text-right text-text-faint tabular-nums">{valueText(chart.series[0]!.values[index] ?? null, unit)}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

/* A bar per category split into its series, on one scale so the rows compare. */
function StackedChart({ chart, unit }: { chart: UiChartData; unit: string | undefined }) {
    return (
        <div className="flex flex-col gap-2">
            {chart.labels.map((label, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                    {chart.labels.length > 1 && <span className="w-2/5 max-w-36 shrink-0 truncate text-text-muted">{label}</span>}
                    <SegmentBar
                        size="sm"
                        className="grow"
                        label={label}
                        range={[0, chart.max]}
                        parts={chart.series.map((series, at) => ({
                            value: Math.max(0, series.values[index] ?? 0),
                            color: seriesColor(at),
                            label: `${series.key} ${valueText(series.values[index] ?? 0, unit)}`
                        }))}
                    />
                </div>
            ))}
        </div>
    );
}

function DrawnChart({ chart, kind, unit }: { chart: UiChartData; kind: ChartKind; unit: string | undefined }) {
    const { t } = useTranslation('agent-chat');
    const [measure, width] = useMeasuredWidth();
    return (
        <figure className="flex flex-col gap-2 px-2">
            {chart.series.length > 1 && <Legend chart={chart} />}
            <div ref={measure} role="img" aria-label={chartSummary(chart, unit, t)} className="relative">
                {kind === 'hbar' ? (
                    <HorizontalChart chart={chart} unit={unit} />
                ) : kind === 'stacked' ? (
                    <StackedChart chart={chart} unit={unit} />
                ) : (
                    <div style={{ height: HEIGHT }}>{width > 0 && <VerticalChart chart={chart} kind={kind} unit={unit} width={width} />}</div>
                )}
            </div>
            <ValuesTable chart={chart} unit={unit} />
        </figure>
    );
}

/*
 * Draws only once its node closed; until then a quiet surface of the height it will take holds its
 * place. It grows in once, and not at all for a person who asked for less motion.
 */
export function ChartRenderer({ node }: UiRendererProps<UiProps<'Chart'>>) {
    const { kind, data, unit } = node.props;
    const chart = useMemo(() => (node.complete ? uiChartData(data, kind) : null), [node.complete, data, kind]);
    if (!node.complete) {
        return <div aria-hidden className="mx-2 rounded-md bg-surface-hover" style={{ height: chartHeight(kind, data.length) }} />;
    }
    if (chart === null) {
        return <UiFallbackPart fallback={node.fallback} problem={{ kind: 'failed' }} />;
    }
    return <DrawnChart chart={chart} kind={kind} unit={unit} />;
}
