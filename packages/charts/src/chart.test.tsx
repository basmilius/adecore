import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { Chart, SeriesLegend, type ChartX } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';
import * as bands from './band.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

interface Score {
    readonly key: string;
    readonly model: string;
    readonly effort: string;
    readonly score: number;
}

const SCORES: Score[] = [
    { key: 'a-low', model: 'Alpha', effort: 'low', score: 40 },
    { key: 'a-high', model: 'Alpha', effort: 'high', score: 52 },
    { key: 'b-low', model: 'Beta', effort: 'low', score: 31 },
    { key: 'b-mid', model: 'Beta', effort: 'mid', score: 38 }
];

const wrap = (node: ReactNode): ReactNode => <UIProvider i18n={i18n}>{node}</UIProvider>;

test('a chart is one named stop for the keyboard and says how to move', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        )
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-roledescription="chart"');
    expect(markup).toContain('aria-label="Scores"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('Arrow keys move between values');
});

test('a chart without data says so', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Chart.Root data={[] as Score[]} x="key" label="Scores">
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        )
    );

    expect(markup).toContain('No data');
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/charts/src/chart.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a mounted chart', () => {
    let container: HTMLDivElement;
    let root: Root;
    let activated: string[];
    let restore: () => void;

    const mount = async (
        node: ReactNode = (
            <Chart.Root data={SCORES} x="key" group="model" label="Scores" selected={['b-low']} onActivate={(row: Score) => activated.push(row.key)}>
                <Chart.XAxis format={(key) => SCORES.find((score) => score.key === key)!.effort} />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        )
    ): Promise<SVGSVGElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);

        await act(async () => {
            root.render(wrap(node));
        });

        return container.querySelector<SVGSVGElement>('svg[role="group"]')!;
    };

    // The DOM of the tests lays nothing out: every box is 600px wide, and a label 7px per character.
    const stubLayout = (): (() => void) => {
        const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
        const measure = SVGTextElement.prototype.getComputedTextLength;
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });

        SVGTextElement.prototype.getComputedTextLength = function (this: SVGTextElement) {
            return (this.textContent?.length ?? 0) * 7;
        };

        return () => {
            if (width === undefined) {
                Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
            } else {
                Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
            }

            SVGTextElement.prototype.getComputedTextLength = measure;
        };
    };

    const columns = (): SVGRectElement[] => [...container.querySelectorAll<SVGRectElement>('rect[style]')];

    const press = async (target: Element, key: string): Promise<void> => {
        await act(async () => {
            target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    const live = (): string => container.querySelector('[aria-live="polite"]')!.textContent ?? '';

    const active = (plot: SVGSVGElement): string | null =>
        document.getElementById(plot.getAttribute('aria-activedescendant') ?? '')?.getAttribute('aria-label') ?? null;

    beforeEach(() => {
        activated = [];
        restore = stubLayout();
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        restore();
    });

    test('cursor moves reuse unchanged row derivation and band layout', async () => {
        let xReads = 0;
        let groupReads = 0;
        const changes: (ChartX | null)[] = [];
        const readX = (row: Score): string => {
            xReads += 1;

            return row.key;
        };
        const readGroup = (row: Score): string => {
            groupReads += 1;

            return row.model;
        };
        const layouts = spyOn(bands, 'bandLayout');
        try {
            const plot = await mount(
                <Chart.Root data={SCORES} x={readX} group={readGroup} label="Scores" onActiveXChange={(value) => changes.push(value)}>
                    <Chart.Bar value="score" label="Score" />
                </Chart.Root>
            );
            const before = { x: xReads, group: groupReads, layouts: layouts.mock.calls.length };
            for (const clientX of [10, 160, 500]) {
                await act(async () => {
                    plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX, clientY: 50 }));
                });
            }

            expect(changes).toEqual(['a-low', 'a-high', 'b-mid']);
            expect({ x: xReads - before.x, group: groupReads - before.group, layouts: layouts.mock.calls.length - before.layouts }).toEqual({
                x: 0,
                group: 0,
                layouts: 0
            });
        } finally {
            layouts.mockRestore();
        }
    });

    test('cached row derivation and geometry follow changed data and accessors', async () => {
        const changes: (ChartX | null)[] = [];
        const readX = (row: Score): string => row.key;
        const readGroup = (row: Score): string => row.model;
        const view = (data: readonly Score[], x: (row: Score) => string, group: (row: Score) => string): ReactNode => (
            <Chart.Root data={data} x={x} group={group} label="Scores" onActiveXChange={(value) => changes.push(value)}>
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );
        const plot = await mount(view(SCORES, readX, readGroup));
        const xs = (): (string | null)[] => columns().map((column) => column.getAttribute('x'));
        const initial = xs();
        await act(async () => root.render(wrap(view(SCORES, readX, (row) => row.effort))));
        expect(xs()).not.toEqual(initial);

        const data = SCORES.map((row, index) => ({ ...row, key: `next-${index}`, score: row.score * 2 }));
        await act(async () => root.render(wrap(view(data, readX, readGroup))));
        await act(async () => plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 50 })));
        expect(changes.at(-1)).toBe('next-0');

        await act(async () => root.render(wrap(view(data, (row) => `${row.key}-accessor`, readGroup))));
        await act(async () => plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 160, clientY: 50 })));
        expect(changes.at(-1)).toBe('next-1-accessor');
    });

    test('cached bands follow width, spacing and orientation changes', async () => {
        const observers = new Map<Element, ControlledResizeObserver>();
        class ControlledResizeObserver implements ResizeObserver {
            private readonly callback: ResizeObserverCallback;
            constructor(callback: ResizeObserverCallback) {
                this.callback = callback;
            }
            observe(target: Element): void {
                observers.set(target, this);
            }
            unobserve(target: Element): void {
                observers.delete(target);
            }
            disconnect(): void {
                for (const [target, observer] of observers) {
                    if (observer === this) {
                        observers.delete(target);
                    }
                }
            }
            resize(target: Element, width: number): void {
                this.callback(
                    [
                        {
                            target,
                            contentRect: new DOMRect(0, 0, width, 200),
                            borderBoxSize: [],
                            contentBoxSize: [],
                            devicePixelContentBoxSize: []
                        }
                    ],
                    this
                );
            }
        }
        const original = globalThis.ResizeObserver;
        globalThis.ResizeObserver = ControlledResizeObserver;
        try {
            const view = (gap: number, orientation: 'vertical' | 'horizontal' = 'vertical', rowHeight = 32, minBucketWidth = 0): ReactNode => (
                <Chart.Root
                    data={SCORES}
                    x="key"
                    group="model"
                    label="Scores"
                    groupGap={gap}
                    orientation={orientation}
                    rowHeight={rowHeight}
                    minBucketWidth={minBucketWidth}
                >
                    <Chart.Bar value="score" label="Score" />
                </Chart.Root>
            );
            const plot = await mount(view(16));
            const observation = [...observers.entries()].find(([target]) => target.contains(plot));
            if (observation === undefined) {
                throw new Error('Chart did not observe its size');
            }
            const [measured, observer] = observation;
            const positions = (): (string | null)[] => columns().map((column) => column.getAttribute('x'));
            const before = positions();
            await act(async () => observer.resize(measured, 420));
            expect(plot.getAttribute('width')).toBe('420');
            expect(positions()).not.toEqual(before);
            const narrowed = positions();
            await act(async () => root.render(wrap(view(32))));
            expect(positions()).not.toEqual(narrowed);
            await act(async () => root.render(wrap(view(32, 'vertical', 32, 200))));
            expect(plot.getAttribute('width')).toBe('864');
            const verticalHeight = plot.getAttribute('height');
            await act(async () => root.render(wrap(view(32, 'horizontal', 48))));
            expect(plot.getAttribute('height')).not.toBe(verticalHeight);
            const rowPositions = columns().map((column) => column.getAttribute('y'));
            await act(async () => root.render(wrap(view(32, 'horizontal', 64))));
            expect(columns().map((column) => column.getAttribute('y'))).not.toEqual(rowPositions);
        } finally {
            globalThis.ResizeObserver = original;
        }
    });

    test('reads each bucket it moves to, the group first', async () => {
        const plot = await mount(
            <Chart.Root data={SCORES} x="key" group="model" label="Scores">
                <Chart.XAxis format={(key) => SCORES.find((score) => score.key === key)!.effort} />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        await press(plot, 'ArrowRight');
        expect(live()).toBe('Alpha, low, Score 40');
        await press(plot, 'ArrowRight');
        expect(live()).toBe('Alpha, high, Score 52');
    });

    test('a pressable bucket is read once, through its button, with the live region left empty', async () => {
        const plot = await mount();
        await press(plot, 'ArrowRight');
        expect(active(plot)).toBe('Alpha, low, Score 40');
        expect(live()).toBe('');
    });

    test('names a group by its label, apart from its key', async () => {
        const plot = await mount(
            <Chart.Root data={SCORES} x="key" group="model" groupLabel={(row: Score) => `Model ${row.model}`} label="Scores">
                <Chart.XAxis format={(key) => SCORES.find((score) => score.key === key)!.effort} />
                <Chart.Bar value="score" label="Score" />
                <Chart.Tooltip />
            </Chart.Root>
        );

        await press(plot, 'ArrowRight');
        expect(live()).toBe('Model Alpha, low, Score 40');
        expect(container.querySelector('.inset-0 p')!.textContent).toBe('Model Alpha · low');
    });

    test('a group label takes its columns and half the gap on each side, so the labels tile the plot', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" group="model" groupGap={20} label="Scores">
                <Chart.Bar value="score" label="Score" />
                <Chart.GroupAxis>{(group) => group.label}</Chart.GroupAxis>
            </Chart.Root>
        );

        const boxes = [...container.querySelectorAll<HTMLDivElement>('.col-start-1')].map((box) => [box.style.marginLeft, box.style.width]);

        expect(boxes).toEqual([
            ['0px', '300px'],
            ['300px', '300px']
        ]);
    });

    test('Page Down goes to the next group and Enter picks the bucket', async () => {
        const plot = await mount();
        await press(plot, 'PageDown');
        await press(plot, 'PageDown');
        expect(active(plot)).toBe('Beta, low, Score 31');
        await press(plot, 'Enter');
        expect(activated).toEqual(['b-low']);
    });

    test('x labels of different widths settle on one set instead of flipping between two', async () => {
        // Twelve buckets of 50px: the short labels fit under every bucket, the long ones under every other.
        const days = Array.from({ length: 12 }, (_, index) => ({ day: index % 2 === 0 ? `d${index}` : `long label ${index}`, value: index }));

        await mount(
            <Chart.Root data={days} x="day" label="Days">
                <Chart.XAxis />
                <Chart.Bar value="value" label="Value" />
            </Chart.Root>
        );

        const labels = [...container.querySelectorAll('text')].filter((text) => text.closest('[visibility="hidden"]') === null);
        expect(labels.map((text) => text.textContent)).toEqual(['d0', 'd2', 'd4', 'd6', 'd8', 'd10']);
    });

    test('columns stand on a time scale, one per bucket of the step, a missing row leaving its slot empty', async () => {
        const hours = [0, 1, 3].map((hour) => ({ at: hour * 3_600_000, count: hour + 1 }));

        await mount(
            <Chart.Root data={hours} x="at" xScale="time" step={3_600_000} label="Per hour">
                <Chart.Bar value="count" label="Count" />
            </Chart.Root>
        );

        // Four hours across 600px: the columns stand in the slots of hour 0, 1 and 3.
        expect(columns().map((column) => Math.floor(Number(column.getAttribute('x')) / 150))).toEqual([0, 1, 3]);
    });

    test('columns on a time scale with one row and no step say why they are missing', async () => {
        const warn = spyOn(console, 'warn').mockImplementation(() => {});

        try {
            await mount(
                <Chart.Root data={[{ at: 0, count: 3 }]} x="at" xScale="time" label="Per hour">
                    <Chart.Bar value="count" label="Count" />
                </Chart.Root>
            );

            expect(columns()).toHaveLength(0);
            expect(warn).toHaveBeenCalledWith('Chart.Bar: a time scale with one row draws no columns without a `step` on the root.');
        } finally {
            warn.mockRestore();
        }
    });

    test('Enter on a time scale presses nothing, as its buckets are no buttons', async () => {
        const hours = [0, 1, 3].map((hour) => ({ at: hour * 3_600_000, count: hour + 1 }));

        const plot = await mount(
            <Chart.Root data={hours} x="at" xScale="time" step={3_600_000} label="Per hour" onActivate={(row) => activated.push(String(row.at))}>
                <Chart.Bar value="count" label="Count" />
            </Chart.Root>
        );

        await press(plot, 'End');
        await press(plot, 'Enter');
        await press(plot, ' ');
        expect(activated).toEqual([]);
    });

    test('a value above `y.max` stops at the top of the plot', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" y={{ max: 40 }} label="Scores">
                <Chart.Bar value="score" label="Score" />
                <Chart.Line value="score" label="Score" />
            </Chart.Root>
        );

        expect(Math.min(...columns().map((column) => Number(column.getAttribute('y'))))).toBe(8);
        const line = container.querySelector('path[fill="none"]')!.getAttribute('d')!;
        expect(Math.min(...[...line.matchAll(/,(-?[\d.]+)/g)].map((match) => Number(match[1])))).toBe(8);
    });

    test('the pointer on a time scale hands on the x of a bucket, once per bucket it enters', async () => {
        const hours = [0, 1, 3].map((hour) => ({ at: hour * 3_600_000, count: hour + 1 }));
        const changes: (ChartX | null)[] = [];

        const plot = await mount(
            <Chart.Root data={hours} x="at" xScale="time" step={3_600_000} label="Per hour" onActiveXChange={(x) => changes.push(x)}>
                <Chart.Bar value="count" label="Count" />
            </Chart.Root>
        );

        for (const clientX of [10, 40, 140, 160, 200, 320, 340, 500]) {
            await act(async () => {
                plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX, clientY: 50 }));
            });
        }

        // Hour 2 has no row, so the pointer over its slot is on no bucket.
        expect(changes).toEqual([0, 3_600_000, null, 10_800_000]);
    });

    test('samples with no step stand at their moment in a window the app fixed, and the pointer takes the nearest', async () => {
        const samples = [250, 500, 750].map((at) => ({ at, load: 1 }));
        const changes: (ChartX | null)[] = [];

        const plot = await mount(
            <Chart.Root
                data={samples}
                x="at"
                xScale="time"
                step={0}
                xOptions={{ min: 0, max: 1000 }}
                margin={{ left: 0, right: 0 }}
                label="Load"
                onActiveXChange={(x) => changes.push(x)}
            >
                <Chart.Line value="load" label="Load" />
            </Chart.Root>
        );

        const line = container.querySelector('path[fill="none"]')!.getAttribute('d')!;
        expect([...line.matchAll(/[ML](-?[\d.]+),/g)].map((match) => Number(match[1]))).toEqual([150, 300, 450]);

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 260, clientY: 50 }));
        });

        expect(changes).toEqual([500]);
    });

    test('a line takes its width, and an area a flat fill with no line over it', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.Area value="score" label="Share" width={0} fill="flat" />
                <Chart.Line value="score" label="Score" width={1} />
            </Chart.Root>
        );

        const paths = [...container.querySelectorAll('path')];
        expect(paths.map((path) => path.getAttribute('fill'))).toEqual(['currentColor', 'none']);
        expect(paths[0]!.getAttribute('fill-opacity')).toBe('0.28');
        expect(paths[1]!.getAttribute('stroke-width')).toBe('1');
        expect(container.querySelector('linearGradient')).toBeNull();
    });

    test('the grid draws its ground heavier than the other lines, or the ground alone', async () => {
        const grid = async (lines?: 'all' | 'ground'): Promise<string[]> => {
            await mount(
                <Chart.Root data={SCORES} x="key" y={{ max: 60 }} label="Scores">
                    <Chart.Grid lines={lines} />
                    <Chart.Bar value="score" label="Score" />
                </Chart.Root>
            );

            const classes = [...container.querySelectorAll('line')].map((line) => line.getAttribute('class') ?? '');
            await act(async () => root.unmount());

            return classes;
        };

        const all = await grid();
        expect(all.filter((name) => name === 'stroke-border-strong')).toHaveLength(1);
        expect(all.filter((name) => name === 'stroke-border-soft').length).toBeGreaterThan(1);
        expect(await grid('ground')).toEqual(['stroke-border-strong']);
        await mount(<Chart.Root data={SCORES} x="key" label="Scores" />);
    });

    test('on a raised surface the halo around labels takes that surface', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" surface="raised" label="Scores">
                <Chart.Bar value="score" label="Score" valueLabels />
                <Chart.Rule value={45} label="A" />
            </Chart.Root>
        );

        const halos = [...container.querySelectorAll<SVGTextElement>('text[paint-order]')].map((text) => text.style.stroke);
        expect(halos).toHaveLength(5);
        expect(new Set(halos)).toEqual(new Set(['var(--surface-raised)']));
    });

    test('a line with dots draws one per value, also when its first render had no width', async () => {
        const error = spyOn(console, 'error').mockImplementation(() => {});

        try {
            await mount(
                <Chart.Root data={SCORES} x="key" label="Scores">
                    <Chart.Line value="score" label="Score" dots />
                </Chart.Root>
            );

            expect(container.querySelectorAll('circle')).toHaveLength(SCORES.length);
            expect(error.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false);
        } finally {
            error.mockRestore();
        }
    });

    test('an x axis keeps its labels apart, writes none without rows, and can stand under the middle of a bucket', async () => {
        const visibleLabels = (): SVGTextElement[] =>
            [...container.querySelectorAll<SVGTextElement>('text')].filter(
                (text) => text.closest('[visibility="hidden"]') === null && text.textContent !== 'No data'
            );

        const hours = Array.from({ length: 48 }, (_, index) => ({ at: index * 3_600_000, count: index }));

        await mount(
            <Chart.Root data={hours} x="at" xScale="linear" label="Per hour">
                <Chart.XAxis ticks={40} format={(x) => `t ${Number(x) / 3_600_000}`} />
                <Chart.Line value="count" label="Count" />
            </Chart.Root>
        );

        const xs = visibleLabels().map((text) => Number(text.getAttribute('x')));
        const widest = Math.max(...visibleLabels().map((text) => (text.textContent?.length ?? 0) * 7));
        expect(xs.length).toBeGreaterThan(2);
        expect(xs.slice(1).every((x, index) => x - xs[index]! >= widest + 8)).toBe(true);
        await act(async () => root.unmount());

        await mount(
            <Chart.Root data={[] as { at: number; count: number }[]} x="at" xScale="time" label="Per hour">
                <Chart.XAxis />
                <Chart.Line value="count" label="Count" />
            </Chart.Root>
        );

        expect(visibleLabels()).toHaveLength(0);
        await act(async () => root.unmount());

        const days = [0, 1, 2].map((day) => ({ at: day * 86_400_000, count: day + 1 }));

        await mount(
            <Chart.Root data={days} x="at" xScale="time" step={86_400_000} label="Per day">
                <Chart.XAxis align="bucket" format={(x) => `d${Number(x) / 86_400_000}`} />
                <Chart.Bar value="count" label="Count" />
            </Chart.Root>
        );

        const centers = columns().map((column) => Number(column.getAttribute('x')) + Number(column.getAttribute('width')) / 2);
        expect(visibleLabels().map((text) => text.textContent)).toEqual(['d0', 'd1', 'd2']);
        expect(visibleLabels().map((text) => Number(text.getAttribute('x')))).toEqual(centers.map(Math.round));
    });

    test('markers and bands name themselves in the tooltip with a swatch, and stay off the plot outside the axis', async () => {
        const hours = [0, 1, 2, 3].map((hour) => ({ at: hour * 3_600_000, count: hour + 1 }));

        const plot = await mount(
            <Chart.Root data={hours} x="at" xScale="time" step={3_600_000} label="Per hour">
                <Chart.Bar value="count" label="Count" />
                <Chart.Marker at={-86_400_000} label="Deploy 1.0" />
                <Chart.Marker at={1_800_000} label="Deploy 1.1" tone="accent" />
                <Chart.Band from={2_000_000} to={2_020_000} label="Collector down" detail="Data may be missing." />
                <Chart.Tooltip />
            </Chart.Root>
        );

        expect(container.querySelectorAll('circle')).toHaveLength(1);
        const hatch = [...container.querySelectorAll('rect')].find((rect) => rect.getAttribute('fill')?.startsWith('url('));
        expect(Number(hatch!.getAttribute('width'))).toBe(4);
        await press(plot, 'Home');
        const card = container.querySelector('[aria-hidden].absolute')!;
        expect(card.textContent).toContain('Deploy 1.1');
        expect(card.textContent).toContain('Collector downData may be missing.');
        expect(card.textContent).not.toContain('Deploy 1.0');
        expect(card.querySelectorAll('.border-dashed')).toHaveLength(1);
        expect(live()).toBe('12:00 AM, Count 1, Deploy 1.1, Collector down, Data may be missing.');
    });

    test('a column reads by its row label and the format of the root, apart from what its axes write', async () => {
        const plot = await mount(
            <Chart.Root data={SCORES} x="key" rowLabel={(row) => `${row.model} ${row.effort}`} format={(value) => `${value} pts`} label="Scores">
                <Chart.XAxis format={(key) => String(key).slice(-1)} />
                <Chart.YAxis />
                <Chart.Bar value="score" label="Score" />
                <Chart.Table />
            </Chart.Root>
        );

        await press(plot, 'ArrowRight');
        expect(live()).toBe('Alpha low, Score 40 pts');
        const texts = [...container.querySelectorAll('text')].map((text) => text.textContent);
        expect(texts).toContain('w');
        expect(texts).toContain('20 pts');
        expect([...container.querySelectorAll('th[scope="row"]')].map((cell) => cell.textContent)).toEqual(['Alpha low', 'Alpha high', 'Beta low', 'Beta mid']);
    });

    test('an x axis names its x apart from its title, and writes its own word for a log scale', async () => {
        const plot = await mount(
            <Chart.Root data={[{ key: 'a', cost: 0.5, score: 40 }]} x="cost" xScale="log" rows="points" rowKey="key" label="Cost">
                <Chart.XAxis title="Cost per task (USD, lower is better)" label="Cost" logLabel="log scale" />
                <Chart.Point value="score" label="Score" />
            </Chart.Root>
        );

        expect([...container.querySelectorAll('text')].some((text) => text.textContent === 'Cost per task (USD, lower is better) · log scale')).toBe(true);
        await press(plot, 'ArrowRight');
        expect(live()).toStartWith('Cost 0.5');
    });

    test('a chart that is not interactive is an image with its label, which the pointer still reads', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" interactive={false} label="Scores">
                <Chart.Bar value="score" label="Score" />
                <Chart.Tooltip />
            </Chart.Root>
        );

        const image = container.querySelector('svg[role="img"]')!;
        expect(image.getAttribute('aria-label')).toBe('Scores');
        expect(image.hasAttribute('tabindex')).toBe(false);
        expect(container.querySelector('[aria-live]')).toBeNull();

        await act(async () => {
            image.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 50 }));
        });

        expect(container.querySelector('[aria-hidden].absolute')!.textContent).toContain('Score40');
    });

    test('the cursor marks a bucket in full, with a line alone, or not at all', async () => {
        const marks = async (cursor: 'full' | 'line' | 'none', xScale: 'band' | 'linear'): Promise<[number, number, number]> => {
            const plot = await mount(
                <Chart.Root
                    data={SCORES.map((score, index) => ({ ...score, at: index }))}
                    x={xScale === 'band' ? 'key' : 'at'}
                    xScale={xScale}
                    cursor={cursor}
                    label="Scores"
                >
                    <Chart.Line value="score" label="Score" />
                </Chart.Root>
            );

            await press(plot, 'Home');

            const counts: [number, number, number] = [
                container.querySelectorAll('rect.fill-surface-hover').length,
                container.querySelectorAll('line.stroke-border-strong').length,
                container.querySelectorAll('circle').length
            ];

            await act(async () => root.unmount());

            return counts;
        };

        expect(await marks('full', 'band')).toEqual([1, 0, 0]);
        expect(await marks('none', 'band')).toEqual([0, 0, 0]);
        expect(await marks('full', 'linear')).toEqual([0, 1, 1]);
        expect(await marks('line', 'linear')).toEqual([0, 1, 0]);
        expect(await marks('none', 'linear')).toEqual([0, 0, 0]);
        await mount(<Chart.Root data={SCORES} x="key" label="Scores" />);
    });

    test('the label under a column dims with it and stands out while it is picked', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" selected={['a-high']} dimmed={(row) => row.model === 'Beta'} label="Scores">
                <Chart.XAxis thin={false} />
                <Chart.Bar value="score" label="Score" dimOpacity={0.3} />
            </Chart.Root>
        );

        const labels = [...container.querySelectorAll('text')].filter((text) => text.closest('[visibility="hidden"]') === null);

        expect(labels.map((text) => [text.textContent, text.getAttribute('opacity'), text.getAttribute('class')?.split(' ')[0]])).toEqual([
            ['a-low', '0.3', 'fill-text-faint'],
            ['a-high', null, 'fill-text'],
            ['b-low', '0.3', 'fill-text-faint'],
            ['b-mid', '0.3', 'fill-text-faint']
        ]);
    });

    test('the pointer passes over another bucket and leaves the keyboard where it was', async () => {
        const changes: (ChartX | null)[] = [];

        const plot = await mount(
            <Chart.Root data={SCORES} x="key" label="Scores" onActivate={(row: Score) => activated.push(row.key)} onActiveXChange={(x) => changes.push(x)}>
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        await press(plot, 'End');

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 50 }));
        });

        expect(active(plot)).toBe('b-mid, Score 38');

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, clientX: 10, clientY: 50 }));
            plot.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, clientX: 10, clientY: 50 }));
        });

        expect(changes).toEqual(['b-mid', 'a-low', 'b-mid']);
        await press(plot, 'ArrowLeft');
        await press(plot, 'Enter');
        expect(activated).toEqual(['b-low']);
    });

    test('a growing chart takes the height of its box, never less than its height', async () => {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
        let box = 400;

        // An empty slot, such as the row of group labels, takes no height.
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get(this: HTMLElement) {
                return this.childElementCount === 0 ? 0 : box;
            }
        });

        try {
            await mount(
                <Chart.Root data={SCORES} x="key" grow height={260} label="Scores">
                    <Chart.Bar value="score" label="Score" />
                </Chart.Root>
            );

            expect(container.querySelector('svg[role="group"]')!.getAttribute('height')).toBe('400');
            await act(async () => root.unmount());
            box = 100;

            await mount(
                <Chart.Root data={SCORES} x="key" grow height={260} label="Scores">
                    <Chart.Bar value="score" label="Score" />
                </Chart.Root>
            );

            expect(container.querySelector('svg[role="group"]')!.getAttribute('height')).toBe('260');
        } finally {
            if (original === undefined) {
                Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
            } else {
                Object.defineProperty(HTMLElement.prototype, 'clientHeight', original);
            }
        }
    });

    test('a tooltip in a corner stays there, and moves to the other side where it would cover the bucket', async () => {
        const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')!;

        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            get(this: HTMLElement) {
                return this.classList.contains('min-w-36') ? 120 : 600;
            }
        });

        try {
            const plot = await mount(
                <Chart.Root data={SCORES} x="key" label="Scores">
                    <Chart.Bar value="score" label="Score" />
                    <Chart.Tooltip placement="top-right" />
                </Chart.Root>
            );

            const card = (): HTMLElement => container.querySelector<HTMLElement>('.min-w-36')!;

            await press(plot, 'Home');
            await press(plot, 'End');
            await press(plot, 'Home');
            expect([card().style.right, card().style.left, card().style.top]).toEqual(['0px', '', '8px']);
            await press(plot, 'End');
            expect([card().style.right, card().style.left]).toEqual(['', '0px']);
        } finally {
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
        }
    });

    test('the table of values hides its button, follows an app that holds it open, and shows rows of its own', async () => {
        const opened: boolean[] = [];

        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.Bar value="score" label="Score" />
                <Chart.Table toggle={false} />
            </Chart.Root>
        );

        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
        await act(async () => root.unmount());

        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.Bar value="score" label="Score" />
                <Chart.Table
                    open
                    onOpenChange={(next) => opened.push(next)}
                    data={{ columns: ['Score', 'Note'], rows: [{ key: 'x', label: 'Hidden model', cells: ['12', 'left out'] }] }}
                />
            </Chart.Root>
        );

        const button = container.querySelector('button')!;
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect([...container.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual(['Hidden model12left out']);

        await act(async () => {
            button.click();
        });

        expect(opened).toEqual([false]);
        expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    test('an x axis says when it left labels of buckets out', async () => {
        const reports: boolean[] = [];
        const many = Array.from({ length: 30 }, (_, index) => ({ key: `bucket ${index}`, value: index }));

        await mount(
            <Chart.Root data={many} x="key" label="Buckets">
                <Chart.XAxis onThinnedChange={(thinned) => reports.push(thinned)} />
                <Chart.Bar value="value" label="Value" />
            </Chart.Root>
        );

        expect(reports.at(-1)).toBe(true);
        await act(async () => root.unmount());
        reports.length = 0;

        await mount(
            <Chart.Root data={many.slice(0, 3)} x="key" label="Buckets">
                <Chart.XAxis onThinnedChange={(thinned) => reports.push(thinned)} />
                <Chart.Bar value="value" label="Value" />
            </Chart.Root>
        );

        expect(reports).toEqual([false]);
    });

    test('columns that animate grow from the ground, and stay as they are under reduced motion', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.Bar value="score" label="Score" animate />
            </Chart.Root>
        );

        const group = columns()[0]!.parentElement!;
        expect(group.getAttribute('class')).toContain('starting:scale-y-0');
        expect(group.getAttribute('class')).toContain('motion-reduce:transition-none');
        expect(group.style.transformOrigin).toBe('0px 200px');
    });

    test('a second x axis writes its row under the first', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.XAxis format={(key) => SCORES.find((score) => score.key === key)!.effort} />
                <Chart.XAxis format={(key) => SCORES.find((score) => score.key === key)!.model} thin={false} />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        const rows = [...container.querySelectorAll('text')].filter((text) => text.closest('[visibility="hidden"]') === null);
        const baselines = [...new Set(rows.map((text) => Number(text.getAttribute('y'))))];
        expect(baselines).toHaveLength(2);
        expect(baselines[1]! - baselines[0]!).toBe(16);
        expect(rows.map((text) => text.textContent)).toEqual(['low', 'high', 'low', 'mid', 'Alpha', 'Alpha', 'Beta', 'Beta']);
        await press(container.querySelector('svg[role="group"]')!, 'ArrowRight');
        expect(live()).toBe('Alpha, low, Score 40');
    });

    test('a column stops at the bottom of the plot when the axis starts above zero', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" y={{ min: 20 }} label="Scores" height={200}>
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        const bottoms = columns().map((column) => Number(column.getAttribute('y')) + Number(column.getAttribute('height')));
        expect(Math.max(...bottoms)).toBe(200);
    });

    test('a rule draws above the series at its value, which the axis covers, and the chart names it once', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.Rule value={70} label="A" />
                <Chart.YAxis />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        const label = [...container.querySelectorAll('text')].find((text) => text.textContent === 'A · 70')!;
        expect(label).toBeDefined();
        const column = columns()[0]!;
        expect(column.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect([...container.querySelectorAll('text')].some((text) => text.textContent === '80')).toBe(true);
        expect(container.querySelector('[id$="-hint"]')!.textContent).toStartWith('A 70.');
        // The label ends where the line ends, 7px over it.
        const line = label.previousElementSibling!;
        expect(label.getAttribute('x')).toBe(line.getAttribute('x2'));
        expect(Number(label.getAttribute('y'))).toBe(Number(line.getAttribute('y1')) - 7.5);
    });

    test('value labels write each column over it, through the function when given, with room above the plot', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" y={{ max: 52 }} label="Scores">
                <Chart.Bar value="score" label="Score" valueLabels={(value) => `${value} pts`} />
            </Chart.Root>
        );

        const labels = [...container.querySelectorAll('text')].map((text) => text.textContent);
        expect(labels).toEqual(['40 pts', '52 pts', '31 pts', '38 pts']);
        // The tallest column reaches the top of the plot, and its label still stands inside the svg.
        const tallest = Math.min(...columns().map((column) => Number(column.getAttribute('y'))));
        expect(tallest).toBe(24);
    });

    test('the margin keeps room beside the plot and lets a chart reach its bottom edge', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" margin={{ right: 16, bottom: 0 }} label="Scores">
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        const drawn = columns();
        // Four buckets share the 584px left of the margin, and every column stands on the bottom of the svg.
        expect(Math.max(...drawn.map((column) => Number(column.getAttribute('x')) + Number(column.getAttribute('width'))))).toBeLessThanOrEqual(584);
        expect(Math.max(...drawn.map((column) => Number(column.getAttribute('x'))))).toBeGreaterThan(438);
        expect(drawn.map((column) => Number(column.getAttribute('y')) + Number(column.getAttribute('height')))).toEqual([200, 200, 200, 200]);
        await act(async () => root.unmount());

        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.XAxis />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        // Under an x axis the plot keeps 4px below its labels; without one it reaches the bottom by default.
        expect(Math.max(...columns().map((column) => Number(column.getAttribute('y')) + Number(column.getAttribute('height'))))).toBeLessThan(200 - 16);
    });

    test('a scrolling plot keeps room over the y axis for what hangs out of its first bucket', async () => {
        const plot = await mount(
            <Chart.Root data={SCORES} x="key" minBucketWidth={400} label="Scores">
                <Chart.YAxis />
                <Chart.Bar value="score" label="Score" valueLabels />
            </Chart.Root>
        );

        const scroller = plot.parentElement!;
        const axis = Number(scroller.previousElementSibling!.getAttribute('width'));
        expect(axis).toBeGreaterThan(0);
        expect(scroller.style.marginLeft).toBe(`-${axis}px`);
        expect(scroller.style.paddingLeft).toBe(`${axis}px`);
    });

    test('value labels stack by the width they measure, not by an estimate per character', async () => {
        // Eighteen buckets of 33px; labels of four characters measure 28px here and are estimated at 32px, which would collide.
        const columns = Array.from({ length: 18 }, (_, index) => ({ key: `c${index}`, value: 10 }));

        await mount(
            <Chart.Root data={columns} x="key" label="Columns">
                <Chart.Bar value="value" label="Value" valueLabels={() => 'abcd'} />
            </Chart.Root>
        );

        const baselines = new Set([...container.querySelectorAll('text')].map((text) => text.getAttribute('y')));
        expect(baselines.size).toBe(1);
    });

    test('the tooltip keeps a row for a series without a value in the bucket', async () => {
        const hours = [
            { at: 0, errors: null, warnings: 3 },
            { at: 3_600_000, errors: 2, warnings: 4 }
        ];

        const plot = await mount(
            <Chart.Root data={hours} x="at" xScale="time" label="Events">
                <Chart.Line value="errors" label="Errors" />
                <Chart.Line value="warnings" label="Warnings" />
                <Chart.Tooltip />
            </Chart.Root>
        );

        await press(plot, 'ArrowRight');
        const rows = [...container.querySelectorAll('.inset-0 p')].slice(1).map((row) => row.textContent);
        expect(rows).toEqual(['Errors-', 'Warnings3']);
    });

    test('in a group every chart draws the cursor and only the chart that moved it shows its tooltip', async () => {
        const plot = await mount(
            <Chart.Group>
                <Chart.Root data={SCORES} x="key" label="Scores">
                    <Chart.Bar value="score" label="Score" />
                    <Chart.Tooltip />
                </Chart.Root>
                <Chart.Root data={SCORES} x="key" label="Scores again">
                    <Chart.Bar value="score" label="Score" />
                    <Chart.Tooltip />
                </Chart.Root>
            </Chart.Group>
        );

        await press(plot, 'ArrowRight');
        const tooltips = [...container.querySelectorAll('.inset-0')].map((slot) => slot.childElementCount);
        expect(tooltips).toEqual([1, 0]);
        expect(container.querySelectorAll('rect.fill-surface-hover')).toHaveLength(2);
    });

    test('a controlled cursor hears that the pointer left', async () => {
        const changes: unknown[] = [];

        const plot = await mount(
            <Chart.Root data={SCORES} x="key" label="Scores" activeX="a-low" onActiveXChange={(x) => changes.push(x)}>
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
        });

        expect(changes).toEqual([null]);
    });

    const MEASURED = [
        { key: 'a-low', model: 'Alpha', effort: 'low', cost: 0.02, score: 40 },
        { key: 'a-high', model: 'Alpha', effort: 'high', cost: 0.3, score: 52 },
        { key: 'b-low', model: 'Beta', effort: 'low', cost: 0.05, score: 39 },
        { key: 'b-mid', model: 'Beta', effort: 'mid', cost: 2, score: 58 }
    ];

    type Measured = (typeof MEASURED)[number];

    const scatter = (props: { onActiveXChange?: (x: unknown) => void } = {}): ReactNode => (
        <Chart.Root
            data={MEASURED}
            rows="points"
            x="cost"
            xScale="log"
            rowKey="key"
            rowLabel="effort"
            group="model"
            y={{ step: 10 }}
            label="Intelligence against cost"
            height={300}
            selected={['b-mid']}
            onActivate={(row: Measured) => activated.push(row.key)}
            onActiveXChange={props.onActiveXChange}
        >
            <Chart.YAxis title="Intelligence" />
            <Chart.XAxis title="Cost per task" format={(value) => `$${value}`} />
            <Chart.Frontier />
            <Chart.Line value="score" label="Intelligence" />
            <Chart.Point value="score" label="Intelligence" />
            <Chart.EndLabels width={100}>{(series) => <span data-end={series.key}>{series.label}</span>}</Chart.EndLabels>
        </Chart.Root>
    );

    test('the table of a point chart leaves out a row the chart draws no point for', async () => {
        const rows = [...MEASURED, { key: 'c-low', model: 'Gamma', effort: 'low', cost: null, score: 45 }];

        await mount(
            <Chart.Root data={rows} rows="points" x="cost" xScale="log" rowKey="key" rowLabel="effort" group="model" label="Cost">
                <Chart.Point value="score" label="Intelligence" />
                <Chart.Table />
            </Chart.Root>
        );

        const labels = [...container.querySelectorAll('tbody tr')].map((row) => row.textContent);
        expect(labels).toHaveLength(MEASURED.length);
        expect(labels.some((label) => label?.startsWith('Gamma'))).toBe(false);
    });

    test('a log axis names both of its ends, the labels moved inward where they would hang past the chart', async () => {
        await mount(
            <Chart.Root data={MEASURED} rows="points" x="cost" xScale="log" label="Cost">
                <Chart.XAxis format={(value) => `$${value}`} />
                <Chart.Point value="score" label="Intelligence" />
            </Chart.Root>
        );

        const labels = [...container.querySelectorAll('text')].map((text) => [text.textContent, Number(text.getAttribute('x'))] as const);
        expect(labels.map(([text]) => text)).toEqual(['$0.01', '$0.1', '$1', '$10']);
        const [first, last] = [labels[0]![1], labels.at(-1)![1]];
        // 7px per character: the widest label, "$0.01", is 35px, so an end label stands half that from an edge of 600px.
        expect([first, last]).toEqual([18, 583]);
    });

    test('a point chart takes the point under the pointer within reach and draws guides to both axes', async () => {
        const changes: unknown[] = [];
        const plot = await mount(scatter({ onActiveXChange: (x) => changes.push(x) }));
        const target = container.querySelector<SVGCircleElement>('circle[role="button"][aria-label^="Alpha, high"]')!;
        const x = Number(target.getAttribute('cx'));
        const y = Number(target.getAttribute('cy'));

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 6, clientY: y - 6 }));
        });

        expect(changes).toEqual(['a-high']);
        const texts = [...container.querySelectorAll('text')].map((text) => text.textContent);
        // The guides write the x and the value of the point on the axes, beside the picked point's.
        expect(texts.filter((text) => text === '$0.3')).toHaveLength(1);
        expect(texts).toContain('Cost per task · logarithmic');
        expect(texts).toContain('Intelligence');
        // Points need no ground: the value axis runs from the step under the lowest point.
        expect(texts).toContain('30');
        expect(texts).not.toContain('0');
        expect(container.querySelectorAll('path[stroke-dasharray="4 4"]')).toHaveLength(2);

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 40, clientY: y + 40 }));
        });

        expect(changes).toEqual(['a-high', null]);
    });

    test('the keyboard moves along a series and to the next one, reads each point and picks it', async () => {
        const plot = await mount(scatter());
        expect(container.querySelector('[id$="-hint"]')!.textContent).toContain('Up and Down to the next series');
        await press(plot, 'ArrowRight');
        await press(plot, 'ArrowRight');
        expect(active(plot)).toBe('Alpha, high, Cost per task $0.3, Intelligence 52');
        await press(plot, 'ArrowDown');
        expect(active(plot)).toBe('Beta, mid, Cost per task $2, Intelligence 58');
        await press(plot, 'Enter');
        expect(activated).toEqual(['b-mid']);
        expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    });

    test('end labels stand right of the plot at the last point of each series, and the frontier runs through the best points', async () => {
        await mount(scatter());
        const labels = [...container.querySelectorAll<HTMLElement>('[data-end]')].map((label) => label.dataset.end);
        expect(labels).toEqual(['Alpha', 'Beta']);
        const frontier = container.querySelector('polyline')!.getAttribute('points')!.split(' ');
        // Beta low costs more than Alpha low and scores less, so it is left off.
        expect(frontier).toHaveLength(3);
    });

    test('a y axis title stands over the axis of a column chart, with room above the plot', async () => {
        await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.YAxis title="Index points, higher is better" />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        const title = [...container.querySelectorAll('text')].find((text) => text.textContent === 'Index points, higher is better')!;
        expect(title.getAttribute('y')).toBe('15');
        const tops = columns().map((column) => Number(column.getAttribute('y')));
        expect(Math.min(...tops)).toBeGreaterThanOrEqual(28);
    });

    test('a y axis on each side keeps its own format, title and ticks', async () => {
        const plot = await mount(
            <Chart.Root data={SCORES} x="key" label="Scores">
                <Chart.YAxis format={(value) => `${value} pt`} />
                <Chart.YAxis side="right" title="Index points" ticks={10} />
                <Chart.Bar value="score" label="Score" />
            </Chart.Root>
        );

        const texts = [...container.querySelectorAll('text')].map((text) => text.textContent ?? '');
        expect(texts).toContain('Index points');
        const right = texts.filter((text) => /^\d+$/.test(text));
        expect(right).toEqual(['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
        expect(texts.filter((text) => text.endsWith(' pt'))).toEqual(right.map((text) => `${text} pt`));
        expect(Math.min(...columns().map((column) => Number(column.getAttribute('y'))))).toBeGreaterThanOrEqual(28);
        await press(plot, 'ArrowRight');
        expect(live()).toBe('a-low, Score 40 pt');
    });

    test('the series legend toggles a series, highlights the one under the pointer and finds by name', async () => {
        const hidden: string[][] = [];
        const highlighted: (string | null)[] = [];

        await mount(
            <SeriesLegend
                label="Models"
                items={[
                    { key: 'a', label: 'Alpha', name: 'North Alpha', group: 'north' },
                    { key: 'b', label: 'Beta', group: 'north' },
                    { key: 'c', label: 'Gamma', group: 'south', status: 'No data', disabled: true }
                ]}
                groups={[
                    { key: 'north', label: 'North' },
                    { key: 'south', label: 'South' }
                ]}
                hidden={['b']}
                onHiddenChange={(next) => hidden.push(next)}
                onHighlightedChange={(key) => highlighted.push(key)}
            />
        );

        const button = (name: string): HTMLButtonElement => container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;

        expect(button('North Alpha').getAttribute('aria-pressed')).toBe('true');
        expect(button('North Alpha').textContent).toBe('Alpha');
        expect(button('Beta').getAttribute('aria-pressed')).toBe('false');
        expect(button('Gamma').disabled).toBe(true);

        await act(async () => {
            button('Beta').click();
            button('North Alpha').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        });

        expect(hidden).toEqual([[]]);
        expect(highlighted).toEqual(['a']);
        const search = container.querySelector('input')!;

        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
            setter.call(search, 'gam');
            search.dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect([...container.querySelectorAll('button[aria-pressed]')].map((entry) => entry.getAttribute('aria-label'))).toEqual(['Gamma']);
    });

    test('a selected bucket is pressed, and Escape clears the cursor', async () => {
        const plot = await mount();
        expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
        await press(plot, 'End');
        expect(plot.getAttribute('aria-activedescendant')).not.toBeNull();
        await press(plot, 'Escape');
        expect(plot.getAttribute('aria-activedescendant')).toBeNull();
    });

    test('a bucket the keyboard moved to lets go when the focus leaves, one under the pointer stays', async () => {
        const plot = await mount();

        const leave = async (): Promise<void> => {
            await act(async () => {
                plot.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
            });
        };

        await press(plot, 'End');
        await leave();
        expect(plot.getAttribute('aria-activedescendant')).toBeNull();

        await act(async () => {
            plot.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 50 }));
        });

        await leave();
        expect(plot.getAttribute('aria-activedescendant')).not.toBeNull();
    });

    test('an Escape that clears the cursor stops at the chart, so a dialog around it stays open', async () => {
        const reached: string[] = [];

        const listen = (e: globalThis.KeyboardEvent): void => {
            reached.push(e.key);
        };

        document.addEventListener('keydown', listen);

        try {
            const plot = await mount();
            await press(plot, 'End');
            await press(plot, 'Escape');
            expect(reached).toEqual(['End']);
            await press(plot, 'Escape');
            expect(reached).toEqual(['End', 'Escape']);
        } finally {
            document.removeEventListener('keydown', listen);
        }
    });
});
