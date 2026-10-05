import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import type { Mounted, RecordedTransport } from '../testing/dom/harness.tsx';
import { SHOP_PATH, shopDatabase } from '../testing/dom/shop.ts';
import {
    MOD,
    byText,
    clientOver,
    click,
    doubleClick,
    done,
    find,
    findAll,
    memoryStorage,
    mount,
    press,
    recordTransport,
    select,
    type
} from '../testing/dom/harness.tsx';
import { fakeDatabaseTransport } from '../testing/index.ts';
import { historyKey, parseHistory } from './history.ts';
import { QueryConsole } from './QueryConsole.tsx';

const connection: Connection = { id: 'one', name: 'Shop', config: { engine: 'sqlite', path: SHOP_PATH } };

const editor = (): HTMLTextAreaElement => find('textarea[aria-label=SQL]') as HTMLTextAreaElement;
const SCRIPT = 'SELECT 1;\nSELECT 2;\nSELECT 3';

describe.skipIf(typeof document === 'undefined')('QueryConsole in a DOM', () => {
    let recorded: RecordedTransport;
    let storage: ReturnType<typeof memoryStorage>;
    let mounted: Mounted;
    let client: ReturnType<typeof clientOver>;

    beforeEach(async () => {
        recorded = recordTransport(fakeDatabaseTransport({ databases: { [SHOP_PATH]: shopDatabase } }));
        recorded.onExecute((sql) => [done(sql, 3)]);
        client = clientOver(recorded.transport);
        storage = memoryStorage();
        mounted = await mount(<QueryConsole connection={connection} />, { client, storage });
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    test('Mod+Enter runs the statement under the caret and nothing else', async () => {
        await type(editor(), SCRIPT);
        await select(editor(), SCRIPT.indexOf('SELECT 2') + 3);
        await press(editor(), 'Enter', MOD);

        expect(recorded.executed()).toEqual(['SELECT 2']);
        expect(document.body.textContent).toContain('Ran: SELECT 2');
    });

    test('Mod+Enter runs the selection when there is one', async () => {
        await type(editor(), SCRIPT);
        await select(editor(), 0, SCRIPT.indexOf('SELECT 3') - 1);
        await press(editor(), 'Enter', MOD);

        expect(recorded.executed()).toEqual(['SELECT 1;\nSELECT 2;']);
        expect(document.body.textContent).toContain('Ran the selection');
    });

    test('Mod+Shift+Enter runs the whole script', async () => {
        await type(editor(), SCRIPT);
        await select(editor(), 2);
        await press(editor(), 'Enter', { ...MOD, shiftKey: true });

        expect(recorded.executed()).toEqual([SCRIPT]);
        expect(document.body.textContent).toContain('Ran all 3 statements');
    });

    test('runs nothing for a blank editor', async () => {
        await type(editor(), '  \n ');
        await press(editor(), 'Enter', MOD);
        expect(recorded.executed()).toEqual([]);
    });

    test('stops a DELETE without WHERE until it is confirmed', async () => {
        await type(editor(), 'DELETE FROM customers');
        await press(editor(), 'Enter', MOD);

        expect(recorded.executed()).toEqual([]);
        const dialog = find('[role=dialog]');
        expect(dialog.textContent).toContain('Run destructive statements?');
        expect(dialog.textContent).toContain('Deletes every row, with no WHERE');
        expect(dialog.textContent).toContain('DELETE FROM customers');

        await click(byText('[role=dialog] button', 'Cancel'));
        expect(recorded.executed()).toEqual([]);
        expect(findAll('[role=dialog]')).toEqual([]);

        await press(editor(), 'Enter', MOD);
        await click(byText('[role=dialog] button', 'Run anyway'));
        expect(recorded.executed()).toEqual(['DELETE FROM customers']);
        expect(findAll('[role=dialog]')).toEqual([]);
    });

    test('lets a DELETE with a WHERE run without asking', async () => {
        await type(editor(), 'DELETE FROM customers WHERE id = 1');
        await press(editor(), 'Enter', MOD);

        expect(findAll('[role=dialog]')).toEqual([]);
        expect(recorded.executed()).toEqual(['DELETE FROM customers WHERE id = 1']);
    });

    test('asks for a destructive statement in the middle of a script that runs all', async () => {
        await type(editor(), 'SELECT 1;\nDROP TABLE customers');
        await press(editor(), 'Enter', { ...MOD, shiftKey: true });

        expect(recorded.executed()).toEqual([]);
        expect(find('[role=dialog]').textContent).toContain('Drops an object');
    });

    test('records a run in the history, keeps it in storage and runs it again from the list', async () => {
        await type(editor(), 'SELECT 1');
        await press(editor(), 'Enter', MOD);

        await click(byText('button', 'History'));
        const entry = byText('aside li button', /SELECT 1/);
        expect(entry.textContent).toContain('3 rows');

        const stored = parseHistory(storage.entries.get(historyKey('one')) ?? null);
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ sql: 'SELECT 1', connection: 'Shop', ok: true, rows: 3 });

        await type(editor(), 'SELECT 99');
        await click(entry);
        expect(editor().value).toBe('SELECT 1');
        expect(recorded.executed()).toEqual(['SELECT 1']);

        await doubleClick(entry);
        expect(recorded.executed()).toEqual(['SELECT 1', 'SELECT 1']);
    });

    test('records a failed run as failed', async () => {
        recorded.onExecute((sql) => [{ kind: 'error', sql, error: { code: 'query-failed', message: 'no such table: nope' }, elapsedMs: 0 }]);
        await type(editor(), 'SELECT * FROM nope');
        await press(editor(), 'Enter', MOD);

        expect(parseHistory(storage.entries.get(historyKey('one')) ?? null)[0]).toMatchObject({ ok: false });
    });

    test('in manual mode begins a transaction before the first run, once, and shows how to end it', async () => {
        recorded.respond('execute', ({ sql }) => ({ results: [done(sql)], inTransaction: true }));
        await click(byText('[role=radio]', 'Manual'));

        await type(editor(), 'INSERT INTO customers (name) VALUES (1)');
        await press(editor(), 'Enter', MOD);
        await press(editor(), 'Enter', MOD);

        const methods = recorded.requests.map((request) => request.method).filter((method) => method === 'transaction' || method === 'execute');
        expect(methods).toEqual(['transaction', 'execute', 'execute']);
        expect(recorded.of('transaction')[0]!.params.action).toBe('begin');
        expect(document.body.textContent).toContain('Transaction open');

        await click(byText('button', 'Commit'));
        expect(recorded.of('transaction').map((request) => request.params.action)).toEqual(['begin', 'commit']);
    });

    test('runs on a session of its own, apart from the one the other views of the connection share', async () => {
        const shared = client.session(connection);
        await shared.schemas();
        await type(editor(), 'SELECT 1');
        await press(editor(), 'Enter', MOD);

        const opened = recorded.of('open');
        expect(opened).toHaveLength(2);
        const executed = recorded.of('execute')[0]!;
        const sessions = recorded.requests.filter((request) => request.method === 'schemas').map((request) => (request.params as { session: string }).session);
        expect(executed.params.session).not.toBe(sessions[0]);
    });

    test('closes its session when it unmounts', async () => {
        await type(editor(), 'SELECT 1');
        await press(editor(), 'Enter', MOD);
        expect(recorded.of('close')).toEqual([]);

        await mounted.unmount();
        expect(recorded.of('close')).toHaveLength(1);
    });

    test('in auto mode sends no begin', async () => {
        await type(editor(), 'SELECT 1');
        await press(editor(), 'Enter', MOD);
        expect(recorded.of('transaction')).toEqual([]);
    });
});
