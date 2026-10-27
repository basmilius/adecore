import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { Chart } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

interface Folder {
    readonly path: string;
    readonly code: number;
    readonly tests: number;
}

const FOLDERS: Folder[] = [
    { path: 'packages/editor/src/language', code: 60, tests: 20 },
    { path: 'packages/ui', code: 40, tests: 10 },
    { path: 'docs', code: 30, tests: 0 },
    { path: 'scripts', code: 10, tests: 5 }
];

const wrap = (node: ReactNode): ReactNode => <UIProvider i18n={i18n}>{node}</UIProvider>;

test('a horizontal chart takes its height from its rows and says how to move between them', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" rowHeight={30} label="Lines per folder">
                <Chart.Bar value="code" label="Code" />
            </Chart.Root>
        )
    );

    // 8 over the plot and four rows of 30.
    expect(markup).toContain('height="128"');
    expect(markup).toContain('Up and Down move between rows');
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/charts/src/horizontal.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a mounted horizontal chart', () => {
    let container: HTMLDivElement;
    let root: Root;
    let restore: () => void;

    const mount = async (node: ReactNode): Promise<SVGSVGElement> => {
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

    const bars = (): SVGRectElement[] => [...container.querySelectorAll<SVGRectElement>('rect[style]')];
    const box = (rect: Element): number[] => ['x', 'y', 'width', 'height'].map((name) => Number(rect.getAttribute(name)));
    const names = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('.truncate')];
    const texts = (): string[] => [...container.querySelectorAll('svg[role="group"] text')].map((text) => text.textContent ?? '');
    const live = (): string => container.querySelector('[aria-live="polite"]')!.textContent ?? '';

    const press = async (target: Element, key: string): Promise<boolean> => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

        await act(async () => {
            target.dispatchEvent(event);
        });

        return event.defaultPrevented;
    };

    beforeEach(() => {
        restore = stubLayout();
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        restore();
    });

    test('names every row left of its bar, in a column as wide as the widest name', async () => {
        await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines per folder">
                <Chart.XAxis />
                <Chart.Bar value="code" label="Code" />
            </Chart.Root>
        );

        expect(names().map((name) => name.textContent)).toEqual(FOLDERS.map((folder) => folder.path));
        // The longest path is 28 characters of 7px, and a pixel more.
        expect(names()[0]!.style.width).toBe('197px');
        expect(names().map((name) => name.style.top)).toEqual(['16px', '48px', '80px', '112px']);
        expect(container.querySelector<HTMLElement>('.relative.shrink-0')!.style.width).toBe('205px');
    });

    test('a name past the limit is cut short, and the tooltip and the live region read it whole', async () => {
        const plot = await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines per folder">
                <Chart.XAxis maxWidth={100} />
                <Chart.Bar value="code" label="Code" />
                <Chart.Tooltip />
            </Chart.Root>
        );

        expect(names()[0]!.style.width).toBe('100px');
        await press(plot, 'ArrowDown');
        expect(live()).toBe('packages/editor/src/language, Code 60');
        expect(container.querySelector('.min-w-36 p')!.textContent).toBe('packages/editor/src/language');
    });

    test('bars run from the ground to the right, one per row in the middle of it', async () => {
        await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" y={{ max: 60 }} label="Lines per folder">
                <Chart.Bar value="code" label="Code" radius={0} />
            </Chart.Root>
        );

        expect(bars().map(box)).toEqual([
            [0, 13, 600, 23],
            [0, 45, 400, 23],
            [0, 77, 300, 23],
            [0, 109, 100, 23]
        ]);
    });

    test('Up and Down step through the rows, and Left and Right are left to the page', async () => {
        const plot = await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines per folder">
                <Chart.Bar value="code" label="Code" />
            </Chart.Root>
        );

        await press(plot, 'ArrowDown');
        await press(plot, 'ArrowDown');
        expect(live()).toBe('packages/ui, Code 40');
        expect(await press(plot, 'ArrowRight')).toBe(false);
        expect(live()).toBe('packages/ui, Code 40');
        await press(plot, 'ArrowUp');
        expect(live()).toBe('packages/editor/src/language, Code 60');
        await press(plot, 'End');
        expect(live()).toBe('scripts, Code 10');
    });

    test('the pointer takes the row it is over, also over its name', async () => {
        const picked: string[] = [];

        await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines per folder" onActivate={(row: Folder) => picked.push(row.path)}>
                <Chart.XAxis />
                <Chart.Bar value="code" label="Code" />
            </Chart.Root>
        );

        const name = names()[2]!;

        await act(async () => {
            name.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 80 }));
            name.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 80 }));
        });

        expect(picked).toEqual(['docs']);
        expect(name.classList.contains('text-text')).toBe(true);
    });

    test('a value stands past the end of its bar, and a stack writes its total once', async () => {
        await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines per folder">
                <Chart.Bars stack>
                    <Chart.Bar value="code" label="Code" valueLabels />
                    <Chart.Bar value="tests" label="Tests" valueLabels />
                </Chart.Bars>
            </Chart.Root>
        );

        expect(texts()).toEqual(['80', '50', '30', '15']);
        const total = container.querySelector('text')!;
        const longest = Math.max(...bars().map((rect) => Number(rect.getAttribute('x')) + Number(rect.getAttribute('width'))));
        expect(Number(total.getAttribute('x'))).toBe(longest + 6);
        expect(total.getAttribute('text-anchor')).toBe('start');
    });

    test('a rule is a line down through the rows, named above the plot', async () => {
        await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" y={{ max: 60 }} label="Lines per folder">
                <Chart.Bar value="code" label="Code" />
                <Chart.Rule value={30} label="Median" />
            </Chart.Root>
        );

        const label = [...container.querySelectorAll('text')].find((text) => text.textContent === 'Median · 30')!;
        const line = label.previousElementSibling!;
        expect([line.getAttribute('x1'), line.getAttribute('x2')]).toEqual(['300.5', '300.5']);
        expect([line.getAttribute('y1'), line.getAttribute('y2')]).toEqual(['20', '148']);
        expect(Number(label.getAttribute('y'))).toBeLessThan(20);
    });

    test('the values run under the plot, which grows by their line', async () => {
        const plot = await mount(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" y={{ max: 60, step: 20 }} label="Lines per folder">
                <Chart.YAxis />
                <Chart.Grid />
                <Chart.Bar value="code" label="Code" />
            </Chart.Root>
        );

        expect(plot.getAttribute('height')).toBe('160');
        const ticks = [...container.querySelectorAll('text')].filter((text) => text.getAttribute('y') === '144');
        expect(ticks.map((text) => text.textContent)).toEqual(['0', '20', '40', '60']);
        const grid = [...container.querySelectorAll('line')].map((line) => line.getAttribute('x1'));
        expect(grid).toEqual(['0.5', '200.5', '400.5', '600.5']);
    });

    test('lines, markers and bands stay out of a horizontal chart, with a warning', async () => {
        const warn = spyOn(console, 'warn').mockImplementation(() => {});

        try {
            await mount(
                <Chart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines per folder">
                    <Chart.Bar value="code" label="Code" />
                    <Chart.Line value="tests" label="Tests" />
                    <Chart.Marker at="docs" label="Moved" />
                    <Chart.Legend />
                </Chart.Root>
            );

            expect(container.querySelector('path')).toBeNull();
            expect(container.querySelector('ul')!.textContent).toBe('Code');
            expect(warn.mock.calls.flat().join(' ')).toContain('draws `Chart.Bar` only');
        } finally {
            warn.mockRestore();
        }
    });
});
