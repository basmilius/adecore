import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { Timeline, type TimelineSpan } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

const SPANS: TimelineSpan[] = [
    { id: 'request', parent: null, label: 'GET /orders', start: 1000, duration: 340, kind: 'http' },
    { id: 'query', parent: 'request', label: 'SELECT orders', start: 1012, duration: 40, kind: 'db' },
    { id: 'render', parent: 'request', label: 'render', start: 1100, duration: 200 },
    { id: 'partial', parent: 'render', label: 'partial', start: 1150, duration: 30 }
];

const KINDS = [
    { id: 'db', label: 'Database' },
    { id: 'http', label: 'Network' }
];

const wrap = (node: ReactNode): ReactNode => <UIProvider i18n={i18n}>{node}</UIProvider>;

test('a row is named by its label, kind, start and duration', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Timeline.Root data={SPANS} kinds={KINDS} label="Spans">
                <Timeline.Rows />
            </Timeline.Root>
        )
    );

    expect(markup).toContain('role="tree"');
    expect(markup).toContain('aria-label="SELECT orders, Database, starts at +12 ms, takes 40 ms"');
});

test('the keyboard hint stands beside the tree, where it is no item of it', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Timeline.Root data={SPANS} kinds={KINDS} label="Spans">
                <Timeline.Rows />
            </Timeline.Root>
        )
    );

    const hintId = /role="tree"[^>]*aria-describedby="([^"]+)"/.exec(markup)![1]!;
    const tree = markup.slice(markup.indexOf('role="tree"'), markup.lastIndexOf('role="treeitem"'));
    expect(tree).not.toContain(`id="${hintId}"`);
    expect(markup).toContain(`id="${hintId}"`);
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/charts/src/timeline.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a mounted timeline', () => {
    let container: HTMLDivElement;
    let root: Root;
    let values: (string | null)[];

    const mount = async (): Promise<HTMLElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);

        await act(async () => {
            root.render(
                wrap(
                    <Timeline.Root data={SPANS} kinds={KINDS} label="Spans" onValueChange={(value) => values.push(value)}>
                        <Timeline.Rows detail={(span) => <p>Detail of {span.label}</p>} />
                    </Timeline.Root>
                )
            );
        });

        return container.querySelector<HTMLElement>('[role="tree"]')!;
    };

    const rows = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];

    const shown = (): string[] => rows().map((row) => row.dataset.span!);

    const stop = (): string[] => rows().flatMap((row) => (row.tabIndex === 0 ? [row.dataset.span!] : []));

    const focus = async (index: number): Promise<void> => {
        await act(async () => rows()[index]!.focus());
    };

    const press = async (key: string): Promise<void> => {
        await act(async () => {
            (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    beforeEach(() => {
        values = [];
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('is one tab stop that the arrows move through the tree', async () => {
        await mount();
        expect(stop()).toEqual(['request']);
        await focus(0);
        await press('ArrowDown');
        await press('ArrowDown');
        expect(document.activeElement?.getAttribute('data-span')).toBe('render');
        expect(stop()).toEqual(['render']);
        await press('ArrowLeft');
        expect(shown()).toEqual(['request', 'query', 'render']);
        expect(rows()[2]!.getAttribute('aria-expanded')).toBe('false');
        await press('ArrowRight');
        expect(shown()).toEqual(['request', 'query', 'render', 'partial']);
        await press('ArrowRight');
        expect(document.activeElement?.getAttribute('data-span')).toBe('partial');
        await press('ArrowLeft');
        expect(document.activeElement?.getAttribute('data-span')).toBe('render');
    });

    test('folding the row that hides the focus hands the tab stop to the folded row', async () => {
        await mount();
        await focus(3);

        await act(async () => {
            rows()[0]!.querySelector<HTMLButtonElement>('button')!.click();
        });

        expect(shown()).toEqual(['request']);
        expect(stop()).toEqual(['request']);
    });

    test('Enter selects a row and shows its detail, and again clears it', async () => {
        await mount();
        await focus(1);
        await press('Enter');
        expect(values).toEqual(['query']);
        expect(rows()[1]!.getAttribute('aria-selected')).toBe('true');
        expect(container.textContent).toContain('Detail of SELECT orders');
        await press('Enter');
        expect(values).toEqual(['query', null]);
        expect(container.textContent).not.toContain('Detail of');
    });
});
