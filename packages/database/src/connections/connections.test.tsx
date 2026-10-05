import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection, DatabaseClient } from '../client/types.ts';
import { ConnectionForm } from './ConnectionForm.tsx';
import { ConnectionManager } from './ConnectionManager.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client: DatabaseClient = {
    test: () => Promise.reject(new Error('stub')),
    session: () => {
        throw new Error('stub');
    },
    disconnect: () => Promise.resolve(),
    dispose: () => Promise.resolve()
};

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client}>{node}</DatabaseProvider>
        </UIProvider>
    );

const sqlite: Connection = { id: 'one', name: 'Notes', config: { engine: 'sqlite', path: '/var/data/notes.sqlite' } };
const mysql: Connection = { id: 'two', name: 'Shop', config: { engine: 'mysql', host: 'db.test', port: 3307, user: 'root', tls: 'prefer' } };

describe('ConnectionForm', () => {
    test('shows the fields of SQLite and no browse button without a handler', () => {
        const markup = render(<ConnectionForm value={sqlite} onValueChange={() => undefined} />);
        expect(markup).toContain('value="Notes"');
        expect(markup).toContain('value="/var/data/notes.sqlite"');
        expect(markup).toContain('Create file');
        expect(markup).not.toContain('Browse');
        expect(markup).not.toContain('Host');
    });

    test('shows a browse button beside the path when the app can open a file dialog', () => {
        const markup = render(<ConnectionForm value={sqlite} onValueChange={() => undefined} onBrowse={() => Promise.resolve(null)} />);
        expect(markup).toContain('Browse');
    });

    test('shows the fields of MySQL, with the password hidden', () => {
        const markup = render(<ConnectionForm value={mysql} onValueChange={() => undefined} />);
        expect(markup).toContain('value="db.test"');
        expect(markup).toContain('value="3307"');
        expect(markup).toContain('type="password"');
        expect(markup).toContain('Encryption');
        expect(markup).not.toContain('Create file');
    });

    test('says why a path that is typed is no good', () => {
        const markup = render(<ConnectionForm value={{ ...sqlite, config: { engine: 'sqlite', path: 'notes.sqlite' } }} onValueChange={() => undefined} />);
        expect(markup).toContain('The path must be absolute.');
        expect(markup).toContain('aria-invalid="true"');
    });

    test('keeps quiet about an empty field nobody touched', () => {
        const markup = render(<ConnectionForm value={{ ...sqlite, config: { engine: 'sqlite', path: '' } }} onValueChange={() => undefined} />);
        expect(markup).not.toContain('Enter the path');
    });

    test('says why a host and a port are no good', () => {
        const bad: Connection = { ...mysql, config: { engine: 'mysql', host: '', port: 70000, user: 'u' } };
        const markup = render(<ConnectionForm value={bad} onValueChange={() => undefined} />);
        expect(markup).toContain('The port is a number from 1 to 65535.');
    });

    test('takes a class name and keeps one root', () => {
        expect(render(<ConnectionForm value={sqlite} onValueChange={() => undefined} className="extra" />)).toContain('class="flex flex-col gap-4 extra"');
    });
});

describe('ConnectionManager', () => {
    test('lists the connections with their target and shows the first one in the detail', () => {
        const markup = render(<ConnectionManager value={[sqlite, mysql]} onValueChange={() => undefined} />);
        expect(markup).toContain('notes.sqlite');
        expect(markup).toContain('root@db.test:3307');
        expect(markup).toContain('Test connection');
        expect(markup).toContain('value="Notes"');
    });

    test('shows the connection it is told to select', () => {
        const markup = render(<ConnectionManager value={[sqlite, mysql]} selected="two" onValueChange={() => undefined} />);
        expect(markup).toContain('value="db.test"');
    });

    test('says there is nothing yet, and still offers a new connection', () => {
        const markup = render(<ConnectionManager value={[]} onValueChange={() => undefined} />);
        expect(markup).toContain('No connections yet.');
        expect(markup).toContain('New connection');
        expect(markup).not.toContain('Test connection');
    });
});
