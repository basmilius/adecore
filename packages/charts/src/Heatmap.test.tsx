import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { Heatmap } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';

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
