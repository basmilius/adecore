import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import type { DatabaseStorage } from '../actions.ts';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { Connection, DatabaseClient } from '../client/types.ts';
import type { StatementResult } from '../protocol/index.ts';
import { statementLabel } from './labels.ts';
import { historyKey, serializeHistory, type HistoryEntry } from './history.ts';
import { HistoryPanel } from './HistoryPanel.tsx';
import { QueryConsole } from './QueryConsole.tsx';
import { SchemaPicker } from './SchemaPicker.tsx';
import { StatementResultView } from './StatementResultView.tsx';
import { TransactionControls } from './TransactionControls.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const client = { session: () => ({}) } as unknown as DatabaseClient;

const render = (node: ReactNode, storage?: DatabaseStorage): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={client} storage={storage}>
                {node}
            </DatabaseProvider>
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

const entries: HistoryEntry[] = [
    { sql: 'SELECT * FROM users', at: 2_000, connection: 'Notes', ok: true, rows: 1234 },
    { sql: 'DELETE FROM\n  orders', at: 1_000, connection: 'Notes', ok: false, rows: null }
];

describe('QueryConsole toolbar', () => {
    test('offers the selection or statement and everything as two buttons, in auto mode with no transaction', () => {
        const markup = render(<QueryConsole connection={connection} defaultValue="SELECT 1" />);
        expect(markup).toMatch(/<button[^>]*>.*Run<\/button>/);
        expect(markup).toContain('Run all');
        expect(markup).toMatch(/role="radio" aria-checked="true"[^>]*>Auto/);
        expect(markup).toMatch(/role="radio" aria-checked="false"[^>]*>Manual/);
        expect(markup).not.toContain('Transaction open');
        expect(markup).not.toContain('aria-label="Schema"');
    });

    test('keeps the history closed until it is asked for, behind a button like Run all', () => {
        const markup = render(<QueryConsole connection={connection} />);
        expect(markup).toMatch(/aria-pressed="false"[^>]*>.*History/);
        expect(markup).toMatch(/<button[^>]*class="[^"]*border-border[^"]*"[^>]*aria-pressed="false"/);
        expect(markup).not.toContain('Search history');
    });

    test('without a connection draws the editor and a bar with only the app’s own content', () => {
        const markup = render(<QueryConsole defaultValue="SELECT 1" toolbarEnd={<button type="button">Run on a connection</button>} />);
        expect(markup).toContain('aria-label="SQL"');
        expect(markup).toContain('>Run on a connection</button>');
        for (const word of ['Run all', 'History', 'Auto', 'aria-label="Schema"']) {
            expect(markup).not.toContain(word);
        }
    });

    test('draws the app’s own content at the end of the bar, before History', () => {
        const markup = render(<QueryConsole connection={connection} toolbarEnd={<span>On Notes</span>} />);
        const end = markup.indexOf('>On Notes</span>');
        expect(end).toBeGreaterThan(markup.indexOf('Run all'));
        expect(end).toBeLessThan(markup.indexOf('aria-pressed="false"'));
    });

    test('opens the history beside the editor with the runs kept for this connection', () => {
        const storage: DatabaseStorage = { get: (key) => (key === historyKey('one') ? serializeHistory(entries) : null), set: () => {} };
        const markup = render(<QueryConsole connection={connection} defaultHistoryOpen />, storage);
        expect(markup).toContain('aria-label="Search history"');
        expect(markup).toContain('SELECT * FROM users');
        expect(markup).toContain('DELETE FROM orders');
        expect(markup).toContain('1,234 rows');
        expect(markup.indexOf('SELECT * FROM users')).toBeLessThan(markup.indexOf('DELETE FROM orders'));
    });

    test('has nothing in the history of a connection that never ran', () => {
        const storage: DatabaseStorage = { get: (key) => (key === historyKey('other') ? serializeHistory(entries) : null), set: () => {} };
        const markup = render(<QueryConsole connection={connection} defaultHistoryOpen />, storage);
        expect(markup).toContain('Nothing has run yet.');
        expect(markup).not.toContain('DELETE FROM orders');
    });
});

describe('HistoryPanel', () => {
    test('says when nothing was run and when the search finds nothing', () => {
        expect(render(<HistoryPanel entries={[]} onPick={() => {}} onClear={() => {}} />)).toContain('Nothing has run yet.');
    });

    test('lists the runs with their outcome and does not offer to clear an empty list', () => {
        const markup = render(<HistoryPanel entries={entries} onPick={() => {}} onClear={() => {}} />);
        expect(markup).toContain('Click to edit, double click to run.');
        expect(render(<HistoryPanel entries={[]} onPick={() => {}} onClear={() => {}} />)).toMatch(
            /<button[^>]* disabled=""[^>]*aria-label="Clear history"|aria-label="Clear history"[^>]* disabled=""/
        );
    });
});

describe('TransactionControls', () => {
    const controls = (props: Partial<Parameters<typeof TransactionControls>[0]> = {}) =>
        render(<TransactionControls mode="manual" onModeChange={() => {}} open busy={false} onCommit={() => {}} onRollback={() => {}} {...props} />);

    test('shows the open transaction with the buttons that end it', () => {
        const markup = controls();
        expect(markup).toMatch(/aria-checked="true"[^>]*>Manual/);
        expect(markup).toContain('Transaction open');
        expect(markup).toContain('Commit');
        expect(markup).toContain('Roll back');
    });

    test('shows no pill without a transaction', () => {
        const markup = controls({ open: false });
        expect(markup).not.toContain('Transaction open');
        expect(markup).not.toContain('Commit');
    });

    test('keeps the buttons from being pressed while a statement runs', () => {
        expect(controls({ busy: true })).toMatch(/<button[^>]* disabled=""[^>]*>Commit/);
    });
});

describe('SchemaPicker', () => {
    test('shows the schema the statements run in', () => {
        const markup = render(<SchemaPicker schemas={[{ name: 'shop', system: false }]} value="shop" onValueChange={() => {}} />);
        expect(markup).toContain('aria-label="Schema"');
        expect(markup).toContain('shop');
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

    test('offers the value panel toggle only when someone listens', () => {
        const result: StatementResult = {
            kind: 'rows',
            sql: 'SELECT 1',
            columns: [{ name: 'a', type: '', kind: 'integer' }],
            rows: [[1]],
            hasMore: false,
            elapsedMs: 1
        };
        expect(render(<StatementResultView result={result} />)).not.toContain('Value panel');
        expect(render(<StatementResultView result={result} onValuePanelOpenChange={() => {}} />)).toMatch(/aria-label="Value panel"[^>]* aria-pressed="false"/);
        expect(render(<StatementResultView result={result} valuePanelOpen onValuePanelOpenChange={() => {}} />)).toMatch(
            /aria-label="Value panel"[^>]* aria-pressed="true"/
        );
    });

    test('pages: counts rows on from the page before and offers previous and next', () => {
        const result: StatementResult = {
            kind: 'rows',
            sql: 'SELECT id FROM t',
            columns: [{ name: 'id', type: 'INTEGER', kind: 'integer' }],
            rows: [[501], [502]],
            hasMore: true,
            elapsedMs: 1
        };
        const markup = render(<StatementResultView result={result} offset={500} pager={{ page: 2, loading: false, onPrevious: () => {}, onNext: () => {} }} />);
        expect(markup).toContain('Rows: 501 to 502');
        expect(markup).toContain('Page 2');
        expect(markup).not.toContain('More rows exist but are not shown.');
        expect(markup).toMatch(/aria-label="Previous page"/);
        expect(markup).not.toMatch(/<button[^>]* disabled=""[^>]*aria-label="Next page"|aria-label="Next page"[^>]* disabled=""/);
    });

    test('cannot go back from the first page or on from the last', () => {
        const result: StatementResult = {
            kind: 'rows',
            sql: 'SELECT 1',
            columns: [{ name: 'a', type: '', kind: 'integer' }],
            rows: [[1]],
            hasMore: false,
            elapsedMs: 1
        };
        const markup = render(<StatementResultView result={result} pager={{ page: 1, loading: false, onPrevious: () => {}, onNext: () => {} }} />);
        expect(markup).toMatch(/aria-label="Previous page"[^>]* disabled=""|disabled=""[^>]*aria-label="Previous page"/);
        expect(markup).toMatch(/aria-label="Next page"[^>]* disabled=""|disabled=""[^>]*aria-label="Next page"/);
    });

    test('offers the export menu only to someone who handles it', () => {
        const result: StatementResult = {
            kind: 'rows',
            sql: 'SELECT 1',
            columns: [{ name: 'a', type: '', kind: 'integer' }],
            rows: [[1]],
            hasMore: false,
            elapsedMs: 1
        };
        expect(render(<StatementResultView result={result} />)).not.toContain('Export result');
        expect(render(<StatementResultView result={result} onExport={() => {}} />)).toContain('aria-label="Export result"');
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
