import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseClient } from '../client/types.ts';
import type { ColumnInfo } from '../protocol/index.ts';
import { ImportForm, type ImportFormProps } from './ImportDialog.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={{} as DatabaseClient}>{node}</DatabaseProvider>
        </UIProvider>
    );

const column = (name: string): ColumnInfo => ({
    name,
    type: 'text',
    kind: 'text',
    nullable: true,
    defaultValue: null,
    autoIncrement: false,
    generated: false,
    comment: null
});

const noop = () => {};

const props: ImportFormProps = {
    path: '/tmp/people.csv',
    tableColumns: [column('id'), column('name')],
    sample: {
        columns: ['ID', 'full name'],
        rows: [
            ['1', 'Ada'],
            ['2', 'Grace']
        ]
    },
    header: true,
    mapping: ['id', null],
    busy: false,
    error: null,
    onHeaderChange: noop,
    onMappingChange: noop,
    onImport: noop,
    onCancel: noop
};

describe('ImportForm', () => {
    test('shows the file, the header switch and a row per file column', () => {
        const markup = render(<ImportForm {...props} />);
        expect(markup).toContain('/tmp/people.csv');
        expect(markup).toContain('First line is a header');
        expect(markup).toMatch(/aria-label="First line is a header"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="First line is a header"/);
        expect(markup).toContain('aria-label="Table column for ID"');
        expect(markup).toContain('aria-label="Table column for full name"');
    });

    test('shows the mapped table column and Skip for the rest', () => {
        const markup = render(<ImportForm {...props} />);
        expect(markup).toContain('>id</span>');
        expect(markup).toContain('>Skip</span>');
    });

    test('previews the sampled rows', () => {
        const markup = render(<ImportForm {...props} />);
        expect(markup).toContain('First 2 rows of the file');
        expect(markup).toContain('>Ada</td>');
        expect(markup).toContain('>Grace</td>');
    });

    test('keeps Import closed until something is mapped, and while it runs', () => {
        expect(render(<ImportForm {...props} />)).not.toMatch(/disabled=""[^>]*>Import<|>Import<\/button>.*disabled/);
        expect(render(<ImportForm {...props} mapping={[null, null]} />)).toMatch(/disabled=""[^>]*>Import</);
        expect(render(<ImportForm {...props} busy />)).toMatch(/disabled=""[^>]*>(<[^>]*>)*Import</);
    });

    test('shows a spinner instead of the mapping while a new sample is read', () => {
        const markup = render(<ImportForm {...props} sample={null} />);
        expect(markup).not.toContain('aria-label="Table column for ID"');
        expect(markup).toContain('Reading the file');
        expect(markup).toMatch(/disabled=""[^>]*>Import</);
    });

    test('shows the reason an import failed', () => {
        expect(render(<ImportForm {...props} error="Row 3 has too many fields." />)).toContain('Row 3 has too many fields.');
    });
});
