import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection, DatabaseClient } from '../client/types.ts';
import type { StatementResult } from '../protocol/index.ts';
import { statementLabel } from './labels.ts';
import { QueryConsole } from './QueryConsole.tsx';
import { StatementResultView } from './StatementResultView.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = { session: () => ({}) } as unknown as DatabaseClient;

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client}>{node}</DatabaseProvider>
        </UIProvider>
    );

const connection: Connection = { id: 'one', name: 'Notes', config: { engine: 'sqlite', path: '/var/data/notes.sqlite' } };

describe('QueryConsole', () => {
    test('starts with an empty editor and a Run button that cannot be pressed', () => {
        const markup = render(<QueryConsole connection={connection} className="h-full" />);
        expect(markup).toContain('<textarea');
        expect(markup).toContain('aria-label="SQL"');
        expect(markup).toMatch(/<button[^>]* disabled=""[^>]*>.*Run/);
        expect(markup).not.toContain('role="grid"');
    });

    test('starts from the default value and leaves the Run button open', () => {
        const markup = render(<QueryConsole connection={connection} defaultValue="SELECT 1" />);
        expect(markup).toContain('>SELECT 1</textarea>');
        expect(markup).not.toMatch(/<button[^>]* disabled=""[^>]*>.*Run/);
    });

    test('shows the value it is handed over its default', () => {
        const markup = render(<QueryConsole connection={connection} value="SELECT 2" defaultValue="SELECT 1" />);
        expect(markup).toContain('>SELECT 2</textarea>');
    });
});

describe('StatementResultView', () => {
    test('shows a result set in a grid with its row count and time', () => {
        const result: StatementResult = {
            kind: 'rows',
            sql: 'SELECT id FROM t',
            columns: [{ name: 'id', type: 'INTEGER', kind: 'integer' }],
            rows: [[1], [2]],
            hasMore: true,
            elapsedMs: 1.25
        };
        const markup = render(<StatementResultView result={result} />);
        expect(markup).toContain('role="grid"');
        expect(markup).toContain('Rows: 2');
        expect(markup).toContain('More rows exist but are not shown.');
        expect(markup).toContain('1.3 ms');
    });

    test('says how many rows a statement affected, and the last insert id', () => {
        const markup = render(<StatementResultView result={{ kind: 'done', sql: 'INSERT', affected: 1, lastInsertId: 42, elapsedMs: 3 }} />);
        expect(markup).toContain('1 row affected');
        expect(markup).toContain('Last insert id: 42');
        expect(render(<StatementResultView result={{ kind: 'done', sql: 'UPDATE', affected: 1234, lastInsertId: null, elapsedMs: 3 }} />)).toContain(
            '1,234 rows affected'
        );
    });

    test('shows the error with its SQLSTATE', () => {
        const markup = render(
            <StatementResultView
                result={{ kind: 'error', sql: 'SELEC', error: { code: 'query-failed', message: 'syntax error', sqlState: '42000' }, elapsedMs: 1 }}
            />
        );
        expect(markup).toContain('syntax error');
        expect(markup).toContain('SQLSTATE 42000');
    });
});

describe('statementLabel', () => {
    test('puts the statement on one line', () => {
        expect(statementLabel('SELECT *\n  FROM users')).toBe('SELECT * FROM users');
    });

    test('cuts a long statement with an ellipsis', () => {
        const label = statementLabel('SELECT id, name, email, created_at FROM users WHERE id > 100');
        expect(label.endsWith('…')).toBe(true);
        expect(label.length).toBeLessThanOrEqual(32);
    });
});
