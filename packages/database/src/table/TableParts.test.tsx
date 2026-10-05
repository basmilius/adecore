import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseClient } from '../client/types.ts';
import { pageBounds } from './paging.ts';
import { TableFooter } from './TableFooter.tsx';
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

const footer = (offset: number, rows: number, hasMore: boolean, counted: number | null) => (
    <TableFooter
        elapsedMs={12.34}
        bounds={pageBounds(offset, rows, hasMore, counted)}
        pageSize={500}
        counting={false}
        onCount={noop}
        onFirst={noop}
        onPrevious={noop}
        onNext={noop}
        onLast={noop}
        onPageSizeChange={noop}
    />
);

const toolbarProps: TableToolbarProps = {
    refreshing: false,
    readOnlyReason: null,
    hasSelection: true,
    canRevertSelection: true,
    valuePanelOpen: false,
    pendingCount: 0,
    submitting: false,
    where: '',
    orderBy: '',
    onFilterChange: noop,
    onApplyFilters: noop,
    onClearFilter: noop,
    onRefresh: noop,
    onAddRow: noop,
    onDeleteRows: noop,
    onCloneRows: noop,
    onRevertRows: noop,
    onToggleValuePanel: noop,
    onSubmit: noop,
    onRevert: noop
};

describe('TableFooter', () => {
    test('shows the time, the range and an open ended total with a way to count', () => {
        const markup = render(footer(0, 500, true, null));
        expect(markup).toContain('Query time');
        expect(markup).toContain('12.3 ms');
        expect(markup).toContain('Rows 1 to 500');
        expect(markup).toContain('of 501+');
        expect(markup).toContain('Count rows');
    });

    test('shows the exact total once it is counted, without the count button', () => {
        const markup = render(footer(0, 500, true, 1234));
        expect(markup).toContain('of 1,234');
        expect(markup).not.toContain('Count rows');
    });

    test('knows the total on the last page', () => {
        const markup = render(footer(500, 120, false, null));
        expect(markup).toContain('Rows 501 to 620');
        expect(markup).toContain('of 620');
        expect(markup).not.toContain('Count rows');
    });

    test('has no previous page on the first page and no next page on the last', () => {
        expect(render(footer(0, 500, true, null))).toMatch(/aria-label="Previous page"[^>]* disabled=""/);
        expect(render(footer(500, 120, false, null))).toMatch(/aria-label="Next page"[^>]* disabled=""/);
    });

    test('has no way to the first page on the first page and none to the last on the last', () => {
        expect(render(footer(0, 500, true, null))).toMatch(/aria-label="First page"[^>]* disabled=""/);
        expect(render(footer(500, 120, false, null))).toMatch(/aria-label="Last page"[^>]* disabled=""/);
    });

    test('leaves the last page open while more rows exist, counted or not', () => {
        expect(render(footer(0, 500, true, null))).not.toMatch(/aria-label="Last page"[^>]* disabled=""/);
        expect(render(footer(0, 500, true, 1234))).not.toMatch(/aria-label="Last page"[^>]* disabled=""/);
        expect(render(footer(500, 500, true, 1234))).not.toMatch(/aria-label="First page"[^>]* disabled=""/);
    });
});

describe('TableToolbar', () => {
    test('offers Submit with the count and Revert while changes are pending', () => {
        const markup = render(<TableToolbar {...toolbarProps} pendingCount={3} />);
        expect(markup).toContain('Submit (3)');
        expect(markup).toContain('>Revert<');
    });

    test('disables the row actions when a reason says the table is read only', () => {
        const markup = render(<TableToolbar {...toolbarProps} readOnlyReason="A view cannot be edited." />);
        expect(markup).toMatch(/aria-label="Add row" aria-disabled="true"/);
        expect(markup).toMatch(/aria-label="Delete selected rows" aria-disabled="true"/);
        expect(markup).not.toMatch(/aria-label="Refresh" aria-disabled/);
    });

    test('offers cloning and reverting the selected rows, and closes them for a read only table', () => {
        const open = render(<TableToolbar {...toolbarProps} />);
        expect(open).not.toMatch(/aria-label="Clone selected rows" aria-disabled/);
        expect(open).not.toMatch(/aria-label="Revert selected rows" aria-disabled/);
        const closed = render(<TableToolbar {...toolbarProps} readOnlyReason="A view cannot be edited." canRevertSelection={false} />);
        expect(closed).toMatch(/aria-label="Clone selected rows" aria-disabled="true"/);
        expect(closed).toMatch(/aria-label="Revert selected rows" aria-disabled="true"/);
    });

    test('has a value panel toggle that says whether the panel is open', () => {
        expect(render(<TableToolbar {...toolbarProps} />)).toMatch(
            /aria-label="Value panel"[^>]* aria-pressed="false"|aria-pressed="false"[^>]*aria-label="Value panel"/
        );
        expect(render(<TableToolbar {...toolbarProps} valuePanelOpen />)).toMatch(
            /aria-label="Value panel"[^>]* aria-pressed="true"|aria-pressed="true"[^>]*aria-label="Value panel"/
        );
    });

    test('keeps deleting closed until a row is selected', () => {
        expect(render(<TableToolbar {...toolbarProps} hasSelection={false} />)).toMatch(/aria-label="Delete selected rows" aria-disabled="true"/);
        expect(render(<TableToolbar {...toolbarProps} />)).not.toMatch(/aria-label="Delete selected rows" aria-disabled/);
    });
});
