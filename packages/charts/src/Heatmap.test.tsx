import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { Heatmap } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';
import * as heat from './heat.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

const ROWS = [
    { key: 'mon', label: 'Monday', short: 'Mon' },
    { key: 'tue', label: 'Tuesday', short: 'Tue' }
];

const COLUMNS = [
    { key: 0, label: '00:00', short: '0' },
    { key: 1, label: '01:00', short: null },
    { key: 2, label: '02:00', short: null }
];

const VALUES = [
    [0, 1, 100],
    [null, 50, 4]
];

const wrap = (node: ReactNode): ReactNode => <UIProvider i18n={i18n}>{node}</UIProvider>;

const heatmap = <Heatmap rows={ROWS} columns={COLUMNS} values={VALUES} label="Events per weekday and hour" valueLabel="Events" />;

test('a heatmap is one named stop for the keyboard with every value in a table', () => {
    const markup = renderToStaticMarkup(wrap(heatmap));
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-roledescription="heatmap"');
    expect(markup).toContain('aria-label="Events per weekday and hour"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('Arrow keys move between cells');
    expect(markup).toContain('<th scope="row">Tuesday</th><td></td><td>50</td><td>4</td>');
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/charts/src/Heatmap.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a mounted heatmap', () => {
    let container: HTMLDivElement;
    let root: Root;

    const mount = async (node: ReactNode = heatmap): Promise<HTMLElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);

        await act(async () => {
            root.render(wrap(node));
        });

        return container.querySelector<HTMLElement>('[role="group"]')!;
    };

    const press = async (target: Element, key: string): Promise<void> => {
        await act(async () => {
            target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    const cells = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[data-mix]')];

    const live = (): string => container.querySelector('[aria-live="polite"]')!.textContent ?? '';

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('pointer selection reuses the matrix and shades only the changed cells', async () => {
        let reads = 0;
        const values = VALUES.map(
            (row) =>
                new Proxy(row, {
                    get(target, key, receiver) {
                        if (typeof key === 'string' && /^\d+$/.test(key)) {
                            reads += 1;
                        }

                        return Reflect.get(target, key, receiver);
                    }
                })
        );
        const changes: ({ row: number; column: number } | null)[] = [];
        const shades = spyOn(heat, 'heatMix');

        try {
            await mount(
                <Heatmap rows={ROWS} columns={COLUMNS} values={values} label="Events" valueLabel="Events" onActiveChange={(cell) => changes.push(cell)} />
            );
            const before = { reads, shades: shades.mock.calls.length };

            const selection = [1, 4, 5];

            for (const index of selection) {
                await act(async () => {
                    cells()[index]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
                });
            }

            expect(changes).toEqual([
                { row: 0, column: 1 },
                { row: 1, column: 1 },
                { row: 1, column: 2 }
            ]);
            expect(cells()[5]!.firstElementChild!.textContent).toBe('Tuesday · 02:00Events4');
            expect(cells()[1]!.firstElementChild).toBeNull();
            expect(shades.mock.calls.length - before.shades).toBeLessThanOrEqual(selection.length * 2);
            expect(reads - before.reads).toBe(0);
        } finally {
            shades.mockRestore();
        }
    });

    test('active cells read new data and labels and keep the existing bounds behavior', async () => {
        const changes: ({ row: number; column: number } | null)[] = [];
        const changedRows = [ROWS[0]!, { ...ROWS[1]!, label: 'Changed Tuesday' }];
        const changedColumns = [COLUMNS[0]!, { ...COLUMNS[1]!, label: '01:00 updated' }, COLUMNS[2]!];
        const changedValues = [VALUES[0]!, [null, 200, 4]];
        const format = (value: number): string => `${value} units`;
        const changed = (rows: typeof ROWS): ReactNode => (
            <Heatmap
                rows={rows}
                columns={changedColumns}
                values={changedValues}
                label="Events"
                valueLabel="Hits"
                format={format}
                onActiveChange={(cell) => changes.push(cell)}
            />
        );
        const group = await mount(
            <Heatmap rows={ROWS} columns={COLUMNS} values={VALUES} label="Events" valueLabel="Events" onActiveChange={(cell) => changes.push(cell)} />
        );
        await act(async () => cells()[4]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
        await act(async () => root.render(wrap(changed(changedRows))));
        expect(cells()[4]!.dataset.mix).toBe('100');
        expect(cells()[4]!.firstElementChild!.textContent).toBe('Changed Tuesday · 01:00 updatedHits200 units');

        await act(async () => root.render(wrap(changed([...changedRows].reverse()))));
        expect(cells()[4]!.firstElementChild!.textContent).toBe('Monday · 01:00 updatedHits200 units');
        expect(cells()[1]!.firstElementChild).toBeNull();
        await act(async () => root.render(wrap(changed(changedRows))));

        await act(async () => root.render(wrap(changed(changedRows.slice(0, 1)))));
        expect(cells().some((cell) => cell.firstElementChild !== null)).toBe(false);
        await act(async () => root.render(wrap(changed(changedRows))));
        expect(cells()[4]!.firstElementChild).not.toBeNull();
        expect(changes).toEqual([{ row: 1, column: 1 }]);

        await act(async () => root.render(wrap(changed(changedRows.slice(0, 1)))));
        await act(async () => group.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
        await act(async () => root.render(wrap(changed(changedRows))));
        expect(cells().some((cell) => cell.firstElementChild !== null)).toBe(false);
        expect(changes).toEqual([{ row: 1, column: 1 }]);
    });

    test('activation uses the latest callback and still reports an unchanged cell only once', async () => {
        const first: unknown[] = [];
        const second: unknown[] = [];
        const view = (notify: (cell: { row: number; column: number } | null) => void): ReactNode => (
            <Heatmap rows={ROWS} columns={COLUMNS} values={VALUES} label="Events" valueLabel="Events" onActiveChange={notify} />
        );
        await mount(view((cell) => first.push(cell)));
        await act(async () => cells()[1]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
        await act(async () => root.render(wrap(view((cell) => second.push(cell)))));
        await act(async () => cells()[1]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
        await act(async () => cells()[4]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
        expect(first).toEqual([{ row: 0, column: 1 }]);
        expect(second).toEqual([{ row: 1, column: 1 }]);
    });

    test('draws an empty cell apart from the lowest count, and the axis only where it has a short label', async () => {
        await mount();
        expect(cells().map((cell) => cell.dataset.mix)).toEqual(['0', '16', '100', '0', '58', '18']);
        expect(cells().map((cell) => cell.classList.contains('bg-surface-sunken'))).toEqual([true, false, false, true, false, false]);
        const header = [...container.querySelectorAll('[aria-hidden] > span')].slice(0, 4).map((span) => span.textContent);
        expect(header).toEqual(['', '0', '', '']);
        expect(container.querySelector('[data-legend="gradient"]')).not.toBeNull();
    });

    test('falls into shades and draws them in the legend when steps are given', async () => {
        await mount(<Heatmap rows={ROWS} columns={COLUMNS} values={VALUES} label="Events" valueLabel="Events" steps={5} />);
        expect(cells().map((cell) => cell.dataset.mix)).toEqual(['0', '15', '100', '0', '58', '15']);
        expect(container.querySelector('[data-legend="gradient"]')).toBeNull();
    });

    test('reads the row, the column and the value of each cell the keyboard moves to', async () => {
        const group = await mount();
        await press(group, 'ArrowRight');
        expect(live()).toBe('Monday, 00:00, Events 0');
        await press(group, 'ArrowDown');
        expect(live()).toBe('Tuesday, 00:00, No data');
        await press(group, 'End');
        expect(live()).toBe('Tuesday, 02:00, Events 4');
        await press(group, 'Escape');
        expect(live()).toBe('');
    });

    test('tells the app which cell the pointer or the keyboard is on, once per change', async () => {
        const heard: ({ row: number; column: number } | null)[] = [];

        const group = await mount(
            <Heatmap rows={ROWS} columns={COLUMNS} values={VALUES} label="Events" valueLabel="Events" onActiveChange={(cell) => heard.push(cell)} />
        );

        const hover = async (): Promise<void> => {
            await act(async () => {
                cells()[4]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
            });
        };

        await hover();
        await hover();
        await press(group, 'ArrowRight');
        await press(group, 'Escape');
        expect(heard).toEqual([{ row: 1, column: 1 }, { row: 1, column: 2 }, null]);
    });

    test('drops the card of the keyboard when the focus leaves', async () => {
        const group = await mount();
        await press(group, 'ArrowRight');
        expect(cells()[0]!.firstElementChild).not.toBeNull();

        await act(async () => {
            group.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });

        expect(cells().some((cell) => cell.firstElementChild !== null)).toBe(false);
    });

    test('shows the exact value of the cell under the pointer in a card', async () => {
        await mount();

        await act(async () => {
            cells()[4]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        });

        const card = cells()[4]!.firstElementChild!;
        expect(card.textContent).toBe('Tuesday · 01:00Events50');

        await act(async () => {
            cells()[3]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        });

        expect(cells()[3]!.firstElementChild!.textContent).toBe('Tuesday · 00:00EventsNo data');
        // The pointer is not the keyboard: the live region stays quiet.
        expect(live()).toBe('');
    });
});
