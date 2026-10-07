import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection } from '../client/types.ts';
import { stubClient } from '../testing/stub.ts';
import { ConnectionForm } from './ConnectionForm.tsx';
import { ConnectionManager } from './ConnectionManager.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = stubClient();

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

    test('offers the four ways to connect, TCP first, and shows no socket field in TCP mode', () => {
        const markup = render(<ConnectionForm value={mysql} onValueChange={() => undefined} />);
        expect(markup).toContain('Connect through');
        for (const label of ['TCP', 'Socket', 'SSH', 'Docker']) {
            expect(markup).toContain(`>${label}</button>`);
        }
        expect(markup).toContain('aria-checked="true"');
        expect(markup).not.toContain('/tmp/mysql.sock');
        expect(markup).not.toContain('SSH host');
    });

    test('shows the socket path in socket mode and no host', () => {
        const markup = render(
            <ConnectionForm
                value={{ ...mysql, config: { ...mysql.config, socket: '/tmp/mysql.sock' } as Connection['config'] }}
                onValueChange={() => undefined}
            />
        );
        expect(markup).toContain('value="/tmp/mysql.sock"');
        expect(markup).not.toContain('value="db.test"');
        expect(markup).not.toContain('SSH host');
    });

    test('asks for the socket once the person has typed some of it', () => {
        const markup = render(
            <ConnectionForm value={{ ...mysql, config: { ...mysql.config, socket: '' } as Connection['config'] }} onValueChange={() => undefined} />
        );
        expect(markup).toContain('placeholder="/tmp/mysql.sock"');
        expect(markup).not.toContain('Enter the path of the socket.');
    });

    const viaSsh: Connection = {
        ...mysql,
        config: {
            engine: 'mysql',
            host: '127.0.0.1',
            port: 3306,
            user: 'root',
            tunnel: { kind: 'ssh', host: 'bastion', port: 2222, user: 'deploy', identityFile: '~/.ssh/id_ed25519' }
        }
    };

    test('shows the SSH host, port, user and key beside the server it reaches', () => {
        const markup = render(<ConnectionForm value={viaSsh} onValueChange={() => undefined} />);
        expect(markup).toContain('SSH host');
        expect(markup).toContain('value="bastion"');
        expect(markup).toContain('value="2222"');
        expect(markup).toContain('value="deploy"');
        expect(markup).toContain('value="~/.ssh/id_ed25519"');
        expect(markup).toContain('Server host');
        expect(markup).toContain('value="127.0.0.1"');
        expect(markup).toContain('A key or the SSH agent has to answer.');
        expect(markup).not.toContain('Browse');
    });

    test('browses for the key of an SSH tunnel when the app can open a file dialog', () => {
        expect(render(<ConnectionForm value={viaSsh} onValueChange={() => undefined} onBrowse={() => Promise.resolve(null)} />)).toContain('Browse');
    });

    test('says why an SSH host that was left empty is no good', () => {
        const bad: Connection = { ...viaSsh, config: { ...viaSsh.config, tunnel: { kind: 'ssh', host: '', port: 99999 } } as Connection['config'] };
        const markup = render(<ConnectionForm value={bad} onValueChange={() => undefined} />);
        expect(markup).toContain('The SSH port is a number from 1 to 65535.');
        expect(markup).not.toContain('Enter the SSH host.');
    });

    const viaDocker: Connection = {
        ...mysql,
        config: { engine: 'mysql', host: '127.0.0.1', user: 'app', tunnel: { kind: 'docker', container: 'shop-db-1', port: 3307 } }
    };

    test('shows the container, its refresh button and the port inside it, and no host', () => {
        const markup = render(<ConnectionForm value={viaDocker} onValueChange={() => undefined} />);
        expect(markup).toContain('Container');
        expect(markup).toContain('Container port');
        expect(markup).toContain('value="3307"');
        expect(markup).toContain('aria-label="Look for containers again"');
        expect(markup).toContain('Looking for containers');
        expect(markup).not.toContain('SSH host');
        expect(markup).not.toContain('>Host<');
    });

    test('asks for a container before one is picked', () => {
        const none: Connection = { ...viaDocker, config: { ...viaDocker.config, tunnel: { kind: 'docker', container: '' } } as Connection['config'] };
        expect(render(<ConnectionForm value={none} onValueChange={() => undefined} />)).toContain('Pick a container');
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

    test('keeps New connection under the list, apart from the rows that scroll', () => {
        const markup = render(<ConnectionManager value={[sqlite, mysql]} onValueChange={() => undefined} />);
        const list = markup.indexOf('aria-label="Connections"');
        expect(list).toBeGreaterThan(-1);
        expect(markup.indexOf('root@db.test:3307')).toBeGreaterThan(list);
        expect(markup.indexOf('New connection')).toBeGreaterThan(markup.indexOf('root@db.test:3307'));
        expect(markup).toMatch(/overflow-y-auto p-2/);
    });

    test('shows the connection it is told to select', () => {
        const markup = render(<ConnectionManager value={[sqlite, mysql]} selected="two" onValueChange={() => undefined} />);
        expect(markup).toContain('value="db.test"');
    });

    test('names a connection through SSH or Docker by where it ends up', () => {
        const viaSsh: Connection = {
            id: 'three',
            name: 'Staging',
            config: { engine: 'mysql', host: '127.0.0.1', user: 'root', tunnel: { kind: 'ssh', host: 'bastion' } }
        };
        const viaDocker: Connection = {
            id: 'four',
            name: 'Local',
            config: { engine: 'mysql', host: '127.0.0.1', user: 'app', tunnel: { kind: 'docker', container: 'shop-db-1' } }
        };
        const markup = render(<ConnectionManager value={[viaSsh, viaDocker]} onValueChange={() => undefined} />);
        expect(markup).toContain('root@127.0.0.1 via bastion');
        expect(markup).toContain('app@shop-db-1 (Docker)');
    });

    test("draws the app's own fields of the picked connection after the form's and before the test", () => {
        const markup = render(
            <ConnectionManager
                value={[sqlite, mysql]}
                selected="two"
                onValueChange={() => undefined}
                renderFields={(connection) => <p>Own {connection.name}</p>}
            />
        );
        expect(markup).toContain('<p>Own Shop</p>');
        expect(markup.indexOf('Read only')).toBeLessThan(markup.indexOf('<p>Own Shop</p>'));
        expect(markup.indexOf('<p>Own Shop</p>')).toBeLessThan(markup.indexOf('Test connection'));
        expect(render(<ConnectionManager value={[]} onValueChange={() => undefined} renderFields={() => <p>Own</p>} />)).not.toContain('<p>Own</p>');
    });

    test('says there is nothing yet, and still offers a new connection', () => {
        const markup = render(<ConnectionManager value={[]} onValueChange={() => undefined} />);
        expect(markup).toContain('No connections yet.');
        expect(markup).toContain('New connection');
        expect(markup).not.toContain('Test connection');
    });
});
