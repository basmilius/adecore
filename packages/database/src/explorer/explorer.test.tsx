import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection } from '../client/types.ts';
import { stubClient } from '../testing/stub.ts';
import { DatabaseExplorer } from './DatabaseExplorer.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = stubClient();

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

    test('has a filter on top and rows of 25 pixels', () => {
        const markup = render(<DatabaseExplorer connections={connections} />);
        expect(markup).toContain('placeholder="Filter tables"');
        expect(markup).toContain('adecore-tree-row');
        expect(markup).toContain('height: var(--tree-row-height, 25px)');
    });

    test('says there is nothing to explore without connections', () => {
        const markup = render(<DatabaseExplorer connections={[]} />);
        expect(markup).toContain('No connections to explore.');
        expect(markup).not.toContain('role="tree"');
    });

    test('marks the row of the selection and no other', () => {
        const markup = render(<DatabaseExplorer connections={connections} value={{ connectionId: 'two' }} />);
        expect(markup.match(/aria-selected="true"/g)).toHaveLength(1);
        expect(markup.match(/aria-selected="false"/g)).toHaveLength(1);
    });

    test('starts at its default selection when it is not controlled', () => {
        const markup = render(<DatabaseExplorer connections={connections} defaultValue={{ connectionId: 'one' }} />);
        expect(markup.match(/aria-selected="true"/g)).toHaveLength(1);
        expect(markup).toContain('tabindex="0"');
    });

    test('selects nothing for a null value', () => {
        const markup = render(<DatabaseExplorer connections={connections} value={null} />);
        expect(markup).not.toContain('aria-selected="true"');
    });

    test('takes a class name', () => {
        expect(render(<DatabaseExplorer connections={connections} className="extra" />)).toContain('extra');
    });
});
