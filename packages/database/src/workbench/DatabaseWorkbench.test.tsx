import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseStorage } from '../actions.ts';
import type { Connection } from '../client/types.ts';
import { stubClient, stubSession } from '../testing/stub.ts';
import { DatabaseWorkbench } from './DatabaseWorkbench.tsx';
import { emptyState, openConsole, openDesigner, openTable, serializeState, STORAGE_KEY } from './tabs.ts';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = stubClient({ session: (connection) => stubSession(connection) });

const connections: Connection[] = [{ id: 'shop', name: 'Shop', config: { engine: 'sqlite', path: '/shop.sqlite' } }];

const storageOf = (raw: string | null): DatabaseStorage => ({ get: (key) => (key === STORAGE_KEY ? raw : null), set: () => {} });

const render = (node: ReactNode, storage?: DatabaseStorage): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client} storage={storage}>
                {node}
            </DatabaseProvider>
        </UIProvider>
    );

describe('DatabaseWorkbench', () => {
    test('shows the explorer beside an empty strip that offers a console', () => {
        const markup = render(<DatabaseWorkbench connections={connections} />);
        expect(markup).toContain('role="tree"');
        expect(markup).toContain('role="tablist"');
        expect(markup).toContain('Nothing open');
        expect(markup).toContain('aria-label="New console"');
        expect(markup).not.toContain('Close tab');
    });

    test('turns the console off without a connection and says why', () => {
        const markup = render(<DatabaseWorkbench connections={[]} />);
        expect(markup).toContain('No connections to explore.');
        expect(markup).toMatch(/<button[^>]*disabled[^>]*>New console<\/button>/);
    });

    test('offers to manage the connections only when it may change them', () => {
        expect(render(<DatabaseWorkbench connections={connections} />)).not.toContain('Manage connections');
        expect(render(<DatabaseWorkbench connections={connections} onConnectionsChange={() => {}} />)).toContain('aria-label="Manage connections"');
    });

    test('brings back the tabs it stored, each closable, with the one in front selected', () => {
        let state = openTable(emptyState, { connectionId: 'shop', schema: 'main', table: 'orders' }, 'data');
        state = openConsole(state, 'shop', 'main');
        state = openDesigner(state, 'shop', 'main', 'items');
        const markup = render(<DatabaseWorkbench connections={connections} />, storageOf(serializeState(state)));
        expect(markup.match(/role="tab"/g)).toHaveLength(3);
        expect(markup.match(/aria-label="Close tab"/g)).toHaveLength(3);
        expect(markup).toContain('orders');
        expect(markup).toContain('Console 1');
        expect(markup).toContain('Design items');
        expect(markup).toMatch(/aria-selected="true"[^>]*>(?:<svg[^>]*>.*?<\/svg>)?Design items/);
        expect(markup).not.toContain('Nothing open');
    });

    test('names a filtered table tab as filtered', () => {
        const state = openTable(emptyState, { connectionId: 'shop', schema: 'main', table: 'orders' }, 'data', 'id = 1');
        expect(render(<DatabaseWorkbench connections={connections} />, storageOf(serializeState(state)))).toContain('orders (filtered)');
    });

    test('ignores the stored tabs of a connection that is gone', () => {
        const state = openConsole(openTable(emptyState, { connectionId: 'gone', schema: 'main', table: 'orders' }, 'data'), 'shop');
        const markup = render(<DatabaseWorkbench connections={connections} />, storageOf(serializeState(state)));
        expect(markup.match(/role="tab"/g)).toHaveLength(1);
        expect(markup).not.toContain('orders');
    });

    test('starts empty from a stored value that is not its own', () => {
        expect(render(<DatabaseWorkbench connections={connections} />, storageOf('not json'))).toContain('Nothing open');
    });

    test('takes a class name and needs a provider above it', () => {
        expect(render(<DatabaseWorkbench connections={connections} className="extra" />)).toContain('extra');
        expect(() =>
            renderToStaticMarkup(
                <UIProvider i18n={i18n}>
                    <DatabaseWorkbench connections={connections} />
                </UIProvider>
            )
        ).toThrow('DatabaseProvider');
    });
});
