import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection } from '../client/types.ts';
import { stubClient, stubSession } from '../testing/stub.ts';
import { TableView } from './TableView.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = stubClient({ session: (connection) => stubSession(connection) });

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client}>{node}</DatabaseProvider>
        </UIProvider>
    );

const writable: Connection = { id: 'one', name: 'Notes', config: { engine: 'sqlite', path: '/var/data/notes.sqlite' } };
const readOnly: Connection = { id: 'two', name: 'Notes', config: { engine: 'sqlite', path: '/var/data/notes.sqlite', readOnly: true } };

describe('TableView', () => {
    test('shows that the rows are loading, with the toolbar already in place', () => {
        const markup = render(<TableView connection={writable} schema="main" table="users" className="h-full" />);
        expect(markup).toContain('Loading rows');
        expect(markup).toContain('aria-label="Refresh"');
        expect(markup).toContain('aria-label="Add row"');
        expect(markup).toContain('h-full');
        expect(markup).not.toContain('role="grid"');
    });

    test('has one command field for filtering, sorting and jumping to a column, and no WHERE or ORDER BY input', () => {
        const markup = render(<TableView connection={writable} schema="main" table="users" />);
        expect(markup.match(/role="combobox"/g)).toHaveLength(1);
        expect(markup).toContain('placeholder="Filter, sort or jump to a column"');
        expect(markup).not.toContain('placeholder="id = 10"');
        expect(markup).not.toContain('ORDER BY');
    });

    test('starts the command field with the chips of a condition it was given', () => {
        const markup = render(<TableView connection={writable} schema="main" table="users" defaultWhere="id = 3" defaultOrderBy="name DESC" />);
        expect(markup).toContain('>id = 3</button>');
        expect(markup).toContain('>name</span>');
        expect(markup).toContain('lucide-arrow-down');
    });

    test('keeps an ORDER BY it cannot read as one chip', () => {
        expect(render(<TableView connection={writable} schema="main" table="users" defaultOrderBy="lower(name)" />)).toContain('lower(name)');
    });

    test('has no submit or revert button while nothing is pending', () => {
        const markup = render(<TableView connection={writable} schema="main" table="users" />);
        expect(markup).not.toContain('Submit');
        expect(markup).not.toContain('>Revert<');
    });

    test('leaves the row actions open on a connection that can write', () => {
        const markup = render(<TableView connection={writable} schema="main" table="users" />);
        expect(markup).not.toMatch(/aria-label="Add row" aria-disabled/);
    });

    test('puts the rest of the actions in a menu', () => {
        expect(render(<TableView connection={writable} schema="main" table="users" />)).toContain('aria-label="More actions"');
    });

    test('disables adding rows on a read only connection', () => {
        const markup = render(<TableView connection={readOnly} schema="main" table="users" />);
        expect(markup).toMatch(/aria-label="Add row" aria-disabled="true"/);
    });
});
