import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseClient } from '../client/types.ts';
import { GridHeaderCell, type GridHeaderCellProps } from './GridHeaderCell.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={{} as DatabaseClient}>{node}</DatabaseProvider>
        </UIProvider>
    );

const noop = () => {};

const props: GridHeaderCellProps = {
    column: { name: 'quantity', type: 'INTEGER', kind: 'integer' },
    index: 1,
    position: 1,
    width: 120,
    sortable: true,
    selected: false,
    id: 'grid-h-1',
    sort: null,
    multipleSorts: false,
    hasSorts: false,
    pinned: false,
    lastPinned: false,
    last: false,
    hasHidden: false,
    canHide: true,
    actions: {
        onSelect: noop,
        onSortDirection: noop,
        onClearSort: noop,
        onResize: noop,
        onFit: noop,
        onHide: noop,
        onShowAll: noop,
        onTogglePin: noop
    }
};

describe('GridHeaderCell', () => {
    test('is plain until its column is picked', () => {
        const markup = render(<GridHeaderCell {...props} />);
        expect(markup).toContain('aria-selected="false"');
        expect(markup).not.toContain('bg-accent');
        expect(markup).not.toContain('data-selected');
        expect(markup).toContain('text-text-muted');
    });

    test('writes the name in the face and size of the cells', () => {
        const markup = render(<GridHeaderCell {...props} />);
        expect(markup).toMatch(/role="columnheader"[^>]*class="[^"]*font-mono text-\(length:--code-font-size\)/);
        expect(markup).not.toMatch(/role="columnheader"[^>]*class="[^"]*text-xs/);
    });

    test('wears the accent when its column is picked, with the menu button in view', () => {
        const markup = render(<GridHeaderCell {...props} selected />);
        expect(markup).toContain('aria-selected="true"');
        expect(markup).toContain('data-selected=""');
        expect(markup).toContain('bg-accent text-accent-text');
        expect(markup).toContain('aria-label="Column menu"');
        expect(markup).not.toMatch(/aria-label="Column menu"[^>]*opacity-0/);
    });

    test('keeps the sort arrow of a sorted column, picked or not', () => {
        const sort = { direction: 'desc' as const, position: 1 };
        expect(render(<GridHeaderCell {...props} sort={sort} />)).toContain('lucide-arrow-down');
        const picked = render(<GridHeaderCell {...props} sort={sort} selected />);
        expect(picked).toContain('lucide-arrow-down');
        expect(picked).toContain('aria-sort="descending"');
    });

    test('draws a yellow key before a primary key, a blue one before a foreign key, and the yellow one for both', () => {
        const primary = render(<GridHeaderCell {...props} column={{ ...props.column, primaryKey: true }} />);
        expect(primary).toMatch(/lucide-key-round [^"]*text-\(--file-icon-yellow\)/);
        const foreign = render(<GridHeaderCell {...props} column={{ ...props.column, foreignKey: true }} />);
        expect(foreign).toMatch(/lucide-key-round [^"]*text-\(--file-icon-blue\)/);
        const both = render(<GridHeaderCell {...props} column={{ ...props.column, primaryKey: true, foreignKey: true }} />);
        expect(both.match(/lucide-key-round/g)).toHaveLength(1);
        expect(both).toContain('text-(--file-icon-yellow)');
        expect(render(<GridHeaderCell {...props} />)).not.toContain('lucide-key');
    });

    test('sets a number against the end and text at the start', () => {
        expect(render(<GridHeaderCell {...props} />)).toContain('justify-end');
        expect(render(<GridHeaderCell {...props} column={{ name: 'name', type: 'TEXT', kind: 'text' }} />)).not.toContain('justify-end');
    });

    test('has a soft line on its edge, a stronger one on the last pinned column and none on the last column', () => {
        expect(render(<GridHeaderCell {...props} />)).toContain('border-r border-border-soft');
        expect(render(<GridHeaderCell {...props} pinned lastPinned />)).toContain('border-border-strong');
        expect(render(<GridHeaderCell {...props} last />)).toContain('border-r-0');
    });
});
