import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { setFormatSource } from '@adecore/ui/format';
import { fakeFormatSource } from '@adecore/ui/testing';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseClient } from '../client/types.ts';
import type { Aggregates } from '../grid/aggregates.ts';
import type { Chip, CommandColumn } from './command-field.ts';
import { pageBounds } from './paging.ts';
import { TableStatusBar, type SelectionFigures } from './TableStatusBar.tsx';
import { TableToolbar, type TableToolbarProps } from './TableToolbar.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={{} as DatabaseClient}>{node}</DatabaseProvider>
        </UIProvider>
    );

const noop = () => {};

const statusBar = (offset: number, rows: number, hasMore: boolean, counted: number | null, selection?: SelectionFigures | null) => (
    <TableStatusBar
        elapsedMs={12.34}
        bounds={pageBounds(offset, rows, hasMore, counted)}
        counting={false}
        selection={selection}
        onCount={noop}
        onPrevious={noop}
        onNext={noop}
    />
);

const columns: CommandColumn[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'quantity', type: 'INTEGER' },
    { name: 'created_at', type: 'TEXT' }
];

const toolbarProps: TableToolbarProps = {
    refreshing: false,
    readOnlyReason: null,
    hasSelection: true,
    canRevertSelection: true,
    valuePanelOpen: false,
    pendingCount: 0,
    submitting: false,
    engine: 'sqlite',
    chips: [],
    columns,
    pageSize: 500,
    bounds: pageBounds(0, 500, true, null),
    onChipsChange: noop,
    onJumpToColumn: noop,
    onRefresh: noop,
    onAddRow: noop,
    onDeleteRows: noop,
    onCloneRows: noop,
    onRevertRows: noop,
    onToggleValuePanel: noop,
    onPageSizeChange: noop,
    onFirstPage: noop,
    onLastPage: noop,
    onSubmit: noop,
    onRevert: noop
};

describe('TableStatusBar', () => {
    test('shows the range and an open ended total as a button that counts', () => {
        const markup = render(statusBar(0, 500, true, null));
        expect(markup).toContain('Rows 1 to 500');
        expect(markup).toContain('>of<');
        expect(markup).toMatch(/<button[^>]*aria-label="Count rows"[^>]*>501\+<\/button>/);
        expect(markup).toContain('12.3 ms');
    });

    test('shows the exact total once it is counted, without the count button', () => {
        const markup = render(statusBar(0, 500, true, 1234));
        expect(markup).toContain('of 1,234');
        expect(markup).not.toContain('Count rows');
    });

    test('knows the total on the last page', () => {
        const markup = render(statusBar(500, 120, false, null));
        expect(markup).toContain('Rows 501 to 620');
        expect(markup).toContain('of 620');
        expect(markup).not.toContain('Count rows');
    });

    test('says there are no rows', () => {
        const markup = render(statusBar(0, 0, false, null));
        expect(markup).toContain('No rows');
        expect(markup).not.toContain('Count rows');
    });

    test('has no previous page on the first page and no next page on the last', () => {
        expect(render(statusBar(0, 500, true, null))).toMatch(/aria-label="Previous page"[^>]* disabled=""/);
        expect(render(statusBar(500, 120, false, null))).toMatch(/aria-label="Next page"[^>]* disabled=""/);
        expect(render(statusBar(500, 500, true, 1234))).not.toMatch(/aria-label="Previous page"[^>]* disabled=""/);
    });

    test('keeps the page size and the first and last page out of the bar', () => {
        const markup = render(statusBar(500, 500, true, null));
        expect(markup).not.toContain('Rows per page');
        expect(markup).not.toContain('First page');
        expect(markup).not.toContain('Last page');
    });
});

describe('TableStatusBar selection', () => {
    const numeric: Aggregates = {
        count: 20,
        numeric: { count: 20, sum: 39, average: 1.95, minimum: 1, maximum: 3, minimumText: '1', maximumText: '3' }
    };

    test('shows nothing about a selection while there is none', () => {
        expect(render(statusBar(0, 10, false, null))).not.toContain('data-selection');
        expect(render(statusBar(0, 10, false, null, null))).not.toContain('Sum');
    });

    test('shows the column, the cell count and the figures of the numbers, labels faint and values plain', () => {
        const markup = render(statusBar(0, 20, false, null, { columns: ['quantity'], aggregates: numeric }));
        expect(markup).toContain('>quantity<');
        expect(markup).toContain('20 cells');
        expect(markup).toContain('<span class="text-text-faint">Sum</span> <span class="text-text">39</span>');
        expect(markup).toContain('<span class="text-text-faint">Avg</span> <span class="text-text">1.95</span>');
        expect(markup).toContain('<span class="text-text-faint">Min</span> <span class="text-text">1</span>');
        expect(markup).toContain('<span class="text-text-faint">Max</span> <span class="text-text">3</span>');
    });

    test('names several columns by their number', () => {
        expect(render(statusBar(0, 20, false, null, { columns: ['a', 'b', 'c'], aggregates: numeric }))).toContain('3 columns');
    });

    test('writes the extremes as the cells wrote them, or in the region notation, and rounds the computed figures', () => {
        const source = fakeFormatSource();
        source.set({ region: 'nl-NL' });
        const previous = setFormatSource(source);
        const exact: Aggregates = {
            count: 3,
            numeric: { count: 3, sum: 12901.255, average: 4300.4183, minimum: 0.5, maximum: 12900.5, minimumText: '0.50', maximumText: '12900.50' }
        };
        const renderIn = (numberNotation: 'database' | 'region'): string =>
            renderToStaticMarkup(
                <UIProvider i18n={i18n} formatSource={source}>
                    <DatabaseProvider client={{} as DatabaseClient} numberNotation={numberNotation}>
                        {statusBar(0, 3, false, null, { columns: ['price'], aggregates: exact })}
                    </DatabaseProvider>
                </UIProvider>
            );
        const database = renderIn('database');
        const region = renderIn('region');
        setFormatSource(previous);
        expect(database).toContain('<span class="text-text">12.901,26</span>');
        expect(database).toContain('<span class="text-text">0.50</span>');
        expect(database).toContain('<span class="text-text">12900.50</span>');
        expect(region).toContain('<span class="text-text">0,50</span>');
        expect(region).toContain('<span class="text-text">12.900,50</span>');
    });

    test('shows only the count when the selection holds no numbers', () => {
        const markup = render(statusBar(0, 4, false, null, { columns: ['name'], aggregates: { count: 4, numeric: null } }));
        expect(markup).toContain('4 cells');
        expect(markup).not.toContain('Sum');
    });
});

describe('TableToolbar', () => {
    test('is the command field with refresh, add row and a menu for the rest', () => {
        const markup = render(<TableToolbar {...toolbarProps} />);
        expect(markup).toContain('role="combobox"');
        expect(markup).toContain('placeholder="Filter, sort or jump to a column"');
        expect(markup).toContain('aria-label="Refresh"');
        expect(markup).toContain('aria-label="Add row"');
        expect(markup).toContain('aria-label="More actions"');
        expect(markup).not.toContain('WHERE');
        expect(markup).not.toContain('ORDER BY');
    });

    test('shows the key that focuses the command field as one small cap per key', () => {
        const caps = [...render(<TableToolbar {...toolbarProps} />).matchAll(/<kbd class="([^"]*)">([^<]*)<\/kbd>/g)];
        expect(caps.map((cap) => cap[2])).toSatisfy((keys: string[]) => keys.join(' ') === '⌘ F' || keys.join(' ') === 'Ctrl F');
        expect(caps.every((cap) => cap[1]!.includes('h-5'))).toBe(true);
    });

    test('draws a filter as a chip with its condition and a sort as an arrow and its column', () => {
        const chips: Chip[] = [
            { kind: 'filter', text: 'quantity > 1', sql: '"quantity" > 1' },
            { kind: 'sort', column: 'created_at', direction: 'desc' }
        ];
        const markup = render(<TableToolbar {...toolbarProps} chips={chips} />);
        expect(markup).toContain('>quantity &gt; 1</button>');
        expect(markup).toContain('lucide-arrow-down');
        expect(markup).toContain('>created_at</span>');
        expect(markup).toContain('aria-label="Remove filter"');
        expect(markup).toContain('aria-label="Remove sort"');
        expect(markup).not.toContain('placeholder=');
    });

    test('shows a raw ORDER BY as text without a button to edit it', () => {
        const markup = render(<TableToolbar {...toolbarProps} chips={[{ kind: 'order', text: 'name NULLS LAST' }]} />);
        expect(markup).toContain('name NULLS LAST');
        expect(markup).not.toContain('aria-label="Edit filter');
    });

    test('offers Submit with the count and Revert while changes are pending', () => {
        const markup = render(<TableToolbar {...toolbarProps} pendingCount={3} />);
        expect(markup).toContain('Submit (3)');
        expect(markup).toContain('>Revert<');
        expect(render(<TableToolbar {...toolbarProps} />)).not.toContain('Submit');
    });

    test('disables adding a row when a reason says the table is read only', () => {
        const markup = render(<TableToolbar {...toolbarProps} readOnlyReason="A view cannot be edited." />);
        expect(markup).toMatch(/aria-label="Add row" aria-disabled="true"/);
        expect(markup).not.toMatch(/aria-label="Refresh" aria-disabled/);
        expect(render(<TableToolbar {...toolbarProps} />)).not.toMatch(/aria-label="Add row" aria-disabled/);
    });

    test('keeps the removed controls out of the row', () => {
        const markup = render(<TableToolbar {...toolbarProps} onToggleRecordView={noop} transfer={{ busy: false, onExport: noop }} />);
        for (const label of ['Delete selected rows', 'Clone selected rows', 'Revert selected rows', 'Value editor', 'Record view', 'Export']) {
            expect(markup).not.toContain(`aria-label="${label}"`);
        }
    });
});
