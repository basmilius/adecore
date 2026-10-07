import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection } from '../client/types.ts';
import { stubClient } from '../testing/stub.ts';
import type { TableStructure } from '../protocol/index.ts';
import { StructureTabs, StructureView } from './StructureView.tsx';
import { referenceOf } from './structure-text.ts';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = stubClient();

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client}>{node}</DatabaseProvider>
        </UIProvider>
    );

const connection: Connection = { id: 'one', name: 'Shop', config: { engine: 'mysql', host: 'h', user: 'u' } };

const structure: TableStructure = {
    schema: 'shop',
    name: 'orders',
    kind: 'table',
    columns: [
        { name: 'id', type: 'bigint', kind: 'integer', nullable: false, defaultValue: null, autoIncrement: true, generated: false, comment: null },
        { name: 'user_id', type: 'bigint', kind: 'integer', nullable: true, defaultValue: '0', autoIncrement: false, generated: false, comment: 'Who ordered' }
    ] as unknown as TableStructure['columns'],
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [{ name: 'PRIMARY', columns: ['id'], unique: true, primary: true }],
    foreignKeys: [
        {
            name: 'fk_user',
            columns: ['user_id'],
            referencedSchema: 'shop',
            referencedTable: 'users',
            referencedColumns: ['id'],
            onUpdate: null,
            onDelete: 'CASCADE'
        }
    ],
    ddl: 'CREATE TABLE orders (id bigint)'
};

describe('StructureView', () => {
    test('shows a spinner while the structure loads', () => {
        const markup = render(<StructureView connection={connection} schema="shop" table="orders" />);
        expect(markup).toContain('aria-label="Loading structure"');
    });

    test('takes a class name', () => {
        expect(render(<StructureView connection={connection} schema="shop" table="orders" className="extra" />)).toContain('extra');
    });
});

describe('StructureTabs', () => {
    test('names the tabs and counts what each holds', () => {
        const markup = render(<StructureTabs structure={structure} />);
        for (const name of ['Columns', 'Indexes', 'Foreign keys', 'DDL']) {
            expect(markup).toContain(name);
        }
    });

    test('draws the app’s own content before the tabs, with a separator after it', () => {
        const markup = render(<StructureTabs structure={structure} start={<span>Shop › shop</span>} />);
        const start = markup.indexOf('>Shop › shop</span>');
        const separator = markup.search(/<span aria-hidden="true" class="[^"]*h-4 w-px/);
        expect(start).toBeGreaterThan(-1);
        expect(start < separator && separator < markup.indexOf('role="tablist"')).toBe(true);
        expect(render(<StructureTabs structure={structure} />)).not.toMatch(/h-4 w-px/);
    });

    test('lists the columns with their type, default, extra and comment', () => {
        const markup = render(<StructureTabs structure={structure} />);
        expect(markup).toContain('user_id');
        expect(markup).toContain('bigint');
        expect(markup).toContain('Auto increment');
        expect(markup).toContain('Who ordered');
        expect(markup).toContain('lucide-key-round');
        expect(markup).toContain('lucide-link-2');
    });
});

describe('referenceOf', () => {
    test('writes schema, table and columns of the target', () => {
        expect(referenceOf({ ...structure.foreignKeys[0]!, referencedColumns: ['a', 'b'] })).toBe('shop.users(a, b)');
    });
});
