import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection, DatabaseClient } from '../client/types.ts';
import { DatabaseExplorer } from './DatabaseExplorer.tsx';

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

const connections: Connection[] = [
    { id: 'one', name: 'Notes', config: { engine: 'sqlite', path: '/notes.sqlite' } },
    { id: 'two', name: 'Shop', config: { engine: 'mysql', host: 'db.test', user: 'root' } }
];

describe('DatabaseExplorer', () => {
    test('is a tree of closed connections with one tab stop', () => {
        const markup = render(<DatabaseExplorer connections={connections} />);
        expect(markup).toContain('role="tree"');
        expect(markup.match(/role="treeitem"/g)).toHaveLength(2);
        expect(markup.match(/aria-expanded="false"/g)).toHaveLength(2);
        expect(markup).toContain('aria-level="1"');
        expect(markup).toContain('aria-setsize="2"');
        expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
        expect(markup).toContain('Notes');
        expect(markup).toContain('Shop');
    });

    test('has a filter on top and rows of 28 pixels', () => {
        const markup = render(<DatabaseExplorer connections={connections} />);
        expect(markup).toContain('placeholder="Filter tables"');
        expect(markup).toContain('h-7');
    });

    test('says there is nothing to explore without connections', () => {
        const markup = render(<DatabaseExplorer connections={[]} />);
        expect(markup).toContain('No connections to explore.');
        expect(markup).not.toContain('role="tree"');
    });

    test('takes a class name', () => {
        expect(render(<DatabaseExplorer connections={connections} className="extra" />)).toContain('extra');
    });
});
