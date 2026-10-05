import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseClient } from '../client/types.ts';
import { DataGrid } from './DataGrid.tsx';
import type { GridColumn, GridRow } from './types.ts';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = { session: () => ({}) } as unknown as DatabaseClient;

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client}>{node}</DatabaseProvider>
        </UIProvider>
    );

const columns: GridColumn[] = [
    { name: 'id', type: 'INTEGER', kind: 'integer', primaryKey: true },
    { name: 'name', type: 'TEXT', kind: 'text' },
    { name: 'avatar', type: 'BLOB', kind: 'binary' }
];

const rows: GridRow[] = [
    { key: 'row:0', number: 1, cells: [7, 'Ada', null] },
    {
        key: 'row:1',
        number: 2,
        cells: [8, { kind: 'longText', preview: 'Grace', length: 900 }, { kind: 'binary', hex: 'abcdef0123456789aa', length: 4096 }],
        edited: new Set([1])
    },
    { key: 'new:1', number: null, cells: [{ kind: 'default' }, 'New', null], state: 'inserted' },
    { key: 'row:2', number: 3, cells: [9, 'Linus', null], state: 'deleted' }
];

describe('DataGrid', () => {
    test('is a grid with its counts, header row and a row per row', () => {
        const markup = render(<DataGrid label="Users" columns={columns} rows={rows} />);
        expect(markup).toContain('role="grid"');
        expect(markup).toContain('aria-label="Users"');
        expect(markup).toContain('aria-rowcount="5"');
        expect(markup).toContain('aria-colcount="4"');
        expect(markup.match(/role="columnheader"/g)).toHaveLength(3);
        expect(markup.match(/role="gridcell"/g)).toHaveLength(12);
    });

    test('draws a key on a primary key column', () => {
        expect(render(<DataGrid label="Users" columns={columns} rows={rows} />).match(/lucide-key-round/g)).toHaveLength(1);
    });

    test('draws NULL faint, numbers at the end and the gutter of an inserted row as a plus', () => {
        const markup = render(<DataGrid label="Users" columns={columns} rows={rows} />);
        expect(markup).toContain('text-text-faint">NULL<');
        expect(markup).toContain('justify-end tabular-nums');
        expect(markup).toContain('>+</div>');
    });

    test('shows a binary value as hex with its size and a long text as a preview', () => {
        const markup = render(<DataGrid label="Users" columns={columns} rows={rows} />);
        expect(markup).toContain('0xabcdef0123456789');
        expect(markup).toContain('4 KB');
        expect(markup).toContain('Grace…');
    });

    test('tints edited cells, inserted rows and rows marked for deletion', () => {
        const markup = render(<DataGrid label="Users" columns={columns} rows={rows} />);
        expect(markup).toContain('bg-accent-soft');
        expect(markup).toContain('bg-positive/10');
        expect(markup).toContain('line-through');
    });

    test('draws only a window of a long table', () => {
        const many: GridRow[] = Array.from({ length: 10_000 }, (_, index) => ({ key: `row:${index}`, number: index + 1, cells: [index, 'x', null] }));
        const markup = render(<DataGrid label="Users" columns={columns} rows={many} />);
        const drawn = markup.match(/role="row"/g)!.length;
        expect(drawn).toBeGreaterThan(10);
        expect(drawn).toBeLessThan(60);
        expect(markup).toContain('aria-rowcount="10001"');
        expect(markup).toContain('height:280000px');
    });

    test('says why there are no rows under the header', () => {
        expect(render(<DataGrid label="Users" columns={columns} rows={[]} empty="Nothing here." />)).toContain('Nothing here.');
    });

    test('sizes columns in whole pixels between 64 and 320', () => {
        const markup = render(<DataGrid label="Users" columns={columns} rows={rows} />);
        const widths = [...markup.matchAll(/role="columnheader"[^>]*style="width:(\d+)px"/g)].map((match) => Number(match[1]));
        expect(widths).toHaveLength(3);
        for (const width of widths) {
            expect(width).toBeGreaterThanOrEqual(64);
            expect(width).toBeLessThanOrEqual(320);
        }
    });
});
