import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection, DatabaseClient } from '../client/types.ts';
import { dialectOf, draftOf, emptyColumn, emptyDraft, type TableDraft } from '../ddl/index.ts';
import type { TableStructure } from '../protocol/index.ts';
import { ColumnsEditor } from './ColumnsEditor.tsx';
import { DesignerView, type DesignerViewProps } from './DesignerView.tsx';
import { ForeignKeysEditor } from './ForeignKeysEditor.tsx';
import { IndexesEditor } from './IndexesEditor.tsx';
import { OptionsEditor } from './OptionsEditor.tsx';
import { planOf } from './plan.ts';
import { TableDesigner } from './TableDesigner.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = {
    test: () => Promise.reject(new Error('stub')),
    session: () => {
        throw new Error('stub');
    },
    disconnect: () => Promise.resolve(),
    dispose: () => Promise.resolve()
} as unknown as DatabaseClient;

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client}>{node}</DatabaseProvider>
        </UIProvider>
    );

const connection: Connection = { id: 'one', name: 'Shop', config: { engine: 'mysql', host: 'h', user: 'u' } };
const mysql = dialectOf({ flavor: 'mysql', version: '8.0.36' });
const sqlite = dialectOf({ flavor: 'sqlite', version: '3.45.1' });

const structure: TableStructure = {
    schema: 'shop',
    name: 'orders',
    kind: 'table',
    columns: [
        { name: 'id', type: 'bigint', kind: 'integer', nullable: false, defaultValue: null, autoIncrement: true, generated: false, comment: null },
        { name: 'total', type: 'int', kind: 'integer', nullable: true, defaultValue: '0', autoIncrement: false, generated: false, comment: 'In cents' },
        { name: 'double', type: 'int', kind: 'integer', nullable: true, defaultValue: null, autoIncrement: false, generated: true, comment: null }
    ],
    primaryKey: ['id'],
    rowKey: ['id'],
    indexes: [
        { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
        { name: 'idx_total', columns: ['total'], unique: false, primary: false }
    ],
    foreignKeys: [
        { name: 'fk_user', columns: ['id'], referencedSchema: 'shop', referencedTable: 'users', referencedColumns: ['id'], onUpdate: null, onDelete: 'CASCADE' }
    ],
    ddl: 'CREATE TABLE `orders` (`id` bigint, `total` int, `double` int GENERATED ALWAYS AS (`total` * 2) VIRTUAL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
};

const view = (draft: TableDraft, props: Partial<DesignerViewProps> = {}, from: TableStructure | null = structure): string => {
    const dialect = props.dialect ?? mysql;
    return render(
        <DesignerView
            dialect={dialect}
            schema="shop"
            draft={draft}
            isNew={from === null}
            changed={false}
            tables={['users', 'orders']}
            plan={planOf(dialect, 'shop', from, draft)}
            readOnlyReason={null}
            failure={null}
            confirming={false}
            referenceColumns={() => ['id']}
            onChange={() => undefined}
            onRequestApply={() => undefined}
            onConfirm={() => Promise.resolve()}
            onCancelConfirm={() => undefined}
            onRevert={() => undefined}
            onDismissFailure={() => undefined}
            {...props}
        />
    );
};

describe('TableDesigner', () => {
    test('shows a spinner while the table loads, for an existing table and for a new one', () => {
        expect(render(<TableDesigner connection={connection} schema="shop" table="orders" />)).toContain('aria-label="Loading table"');
        expect(render(<TableDesigner connection={connection} schema="shop" />)).toContain('aria-label="Loading table"');
    });

    test('takes a class name', () => {
        expect(render(<TableDesigner connection={connection} schema="shop" className="extra" />)).toContain('extra');
    });
});

describe('DesignerView', () => {
    test('shows a new table with the tabs, a disabled Create and the problems in place of SQL', () => {
        const markup = view(emptyDraft(), {}, null);
        for (const word of ['Table name', 'Columns', 'Indexes', 'Foreign keys', 'Options', 'Create table', 'Add column']) {
            expect(markup).toContain(word);
        }
        expect(markup).toContain('The table needs a name.');
        expect(markup).toContain('The table needs at least one column.');
    });

    test('shows the columns of a table and No changes while nothing changed', () => {
        const markup = view(draftOf(structure));
        expect(markup).toContain('value="orders"');
        for (const word of ['value="bigint"', 'value="total"', 'In cents', 'Apply', 'No changes', 'GENERATED ALWAYS AS']) {
            expect(markup).toContain(word);
        }
    });

    test('shows what Apply would run, and enables it', () => {
        const draft = { ...draftOf(structure), columns: [...draftOf(structure).columns, { ...emptyColumn('note'), type: 'text' }] };
        const markup = view(draft, { changed: true });
        expect(markup).toContain('ALTER TABLE `shop`.`orders`');
        expect(markup).toContain('ADD COLUMN `note` text NULL;');
        expect(markup).not.toContain('No changes');
    });

    test('says why nothing can be edited on a read only connection', () => {
        const markup = view(draftOf(structure), { readOnlyReason: 'This connection is read only.' });
        expect(markup).toContain('This connection is read only.');
        expect(markup).toContain('disabled=""');
    });

    test('shows the message of a failed apply', () => {
        expect(view(draftOf(structure), { failure: 'Duplicate column name' })).toContain('Duplicate column name');
    });

    test('takes a class name', () => {
        expect(view(draftOf(structure), { className: 'extra' })).toContain('extra');
    });
});

describe('the tabs of the designer', () => {
    const props = { disabled: false, onChange: () => undefined };

    test('the columns tab leaves out what SQLite has no word for', () => {
        const draft = draftOf(structure);
        expect(render(<ColumnsEditor draft={draft} dialect={mysql} {...props} />)).toContain('Comment');
        expect(render(<ColumnsEditor draft={draft} dialect={sqlite} {...props} />)).not.toContain('Comment');
        expect(render(<ColumnsEditor draft={draft} dialect={sqlite} {...props} />)).toContain('<option value="INTEGER">');
    });

    test('the indexes tab lists the indexes with the columns of the draft to pick from', () => {
        const markup = render(<IndexesEditor draft={draftOf(structure)} dialect={mysql} {...props} />);
        expect(markup).toContain('value="idx_total"');
        expect(markup).toContain('Add index');
        expect(render(<IndexesEditor draft={emptyDraft()} dialect={mysql} {...props} />)).toContain('no indexes');
    });

    test('the foreign keys tab shows the key, its table and the columns to pick from', () => {
        const markup = render(
            <ForeignKeysEditor
                draft={draftOf(structure)}
                dialect={mysql}
                schema="shop"
                tables={['users']}
                referenceColumns={() => ['id', 'email']}
                {...props}
            />
        );
        expect(markup).toContain('value="fk_user"');
        expect(markup).toContain('References table');
        expect(markup).toContain('email');
        expect(
            render(<ForeignKeysEditor draft={draftOf(structure)} dialect={mysql} schema="shop" tables={['users']} referenceColumns={() => null} {...props} />)
        ).toContain('Loading columns');
    });

    test('the options tab differs per engine', () => {
        const draft = draftOf(structure);
        const mysqlMarkup = render(<OptionsEditor draft={draft} dialect={mysql} {...props} />);
        expect(mysqlMarkup).toContain('value="InnoDB"');
        expect(mysqlMarkup).toContain('value="utf8mb4"');
        const sqliteMarkup = render(<OptionsEditor draft={draft} dialect={sqlite} {...props} />);
        expect(sqliteMarkup).toContain('Without rowid');
        expect(sqliteMarkup).not.toContain('Storage engine');
    });
});
