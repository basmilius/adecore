import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { DatabaseAction } from '../actions.ts';
import type { Connection, SchemaChange } from '../client/types.ts';
import type { Mounted, RecordedTransport } from '../testing/dom/harness.tsx';
import { SHOP_PATH, shopDatabase } from '../testing/dom/shop.ts';
import { MOD, byText, clientOver, click, done, find, findAll, mount, press, recordTransport, type, waitFor } from '../testing/dom/harness.tsx';
import { fakeDatabaseTransport } from '../testing/index.ts';
import { TableDesigner } from './TableDesigner.tsx';

const connection: Connection = { id: 'one', name: 'Shop', config: { engine: 'sqlite', path: SHOP_PATH } };

const preview = (): string => (find('section[aria-label=SQL]').textContent ?? '').replace(/\s+/g, ' ');
const applyButton = (label: string): HTMLButtonElement => byText('button', label) as HTMLButtonElement;
const nameFields = (): HTMLInputElement[] => findAll('input[aria-label=Name]') as HTMLInputElement[];

describe.skipIf(typeof document === 'undefined')('TableDesigner in a DOM', () => {
    let recorded: RecordedTransport;
    let client: ReturnType<typeof clientOver>;
    let actions: DatabaseAction[];
    let changes: SchemaChange[];
    let mounted: Mounted;
    let stopListening: () => void;

    const open = async (table?: string, config: Connection['config'] = connection.config): Promise<void> => {
        mounted = await mount(<TableDesigner connection={{ ...connection, config }} schema="main" table={table} />, { client, actions });
    };

    beforeEach(() => {
        recorded = recordTransport(fakeDatabaseTransport({ databases: { [SHOP_PATH]: shopDatabase } }));
        recorded.onExecute((sql) => [done(sql, 0)]);
        client = clientOver(recorded.transport);
        actions = [];
        changes = [];
        stopListening = client.onSchemaChange((change) => changes.push(change));
    });

    afterEach(async () => {
        stopListening();
        await mounted.unmount();
        await client.dispose();
    });

    test('starts from the table as it is, with Apply closed and nothing to run', async () => {
        await open('customers');

        expect(nameFields().map((field) => field.value)).toEqual(['id', 'name']);
        expect(preview()).toContain('No changes');
        expect(applyButton('Apply').disabled).toBe(true);
        expect(applyButton('Revert').disabled).toBe(true);
    });

    test('shows the SQL of a new column as soon as it is added, and updates it as the column is edited', async () => {
        await open('customers');
        await click(byText('button', 'Add column'));

        expect(nameFields()).toHaveLength(3);
        expect(preview()).toContain('ALTER TABLE "customers" ADD COLUMN "column_3" INTEGER;');
        expect(applyButton('Apply').disabled).toBe(false);

        await type(nameFields()[2]!, 'nickname');
        await type(find('input[aria-label=Type]', findAll('tbody tr').at(-1)!) as HTMLInputElement, 'TEXT');
        expect(preview()).toContain('ALTER TABLE "customers" ADD COLUMN "nickname" TEXT;');
    });

    test('Revert puts the table back', async () => {
        await open('customers');
        await click(byText('button', 'Add column'));
        await click(byText('button', 'Revert'));

        expect(nameFields()).toHaveLength(2);
        expect(preview()).toContain('No changes');
    });

    test('Apply asks first, then runs the statements, tells the client once and loads the table again', async () => {
        await open('customers');
        await click(byText('button', 'Add column'));
        await type(nameFields()[2]!, 'nickname');
        await click(applyButton('Apply'));

        const dialog = find('[role=dialog]');
        expect(dialog.textContent).toContain('Run 1 statement?');
        expect(dialog.textContent).toContain('ALTER TABLE "customers" ADD COLUMN "nickname" INTEGER;');
        expect(recorded.executed()).toEqual([]);
        expect(changes).toEqual([]);

        const structures = recorded.of('structure').length;
        await click(byText('[role=dialog] button', 'Apply'));

        expect(recorded.executed()).toEqual(['ALTER TABLE "customers" ADD COLUMN "nickname" INTEGER']);
        expect(changes).toEqual([{ connectionId: 'one', schema: 'main' }]);
        await waitFor(() => expect(recorded.of('structure').length).toBeGreaterThan(structures));
        expect(findAll('[role=dialog]')).toEqual([]);
    });

    test('Mod+S asks as Apply does', async () => {
        await open('customers');
        await click(byText('button', 'Add column'));
        await press(nameFields()[0]!, 's', { ...MOD, code: 'KeyS' });

        expect(find('[role=dialog]').textContent).toContain('Run 1 statement?');
    });

    test('Mod+S asks nothing while there is nothing to apply', async () => {
        await open('customers');
        await press(nameFields()[0]!, 's', { ...MOD, code: 'KeyS' });

        expect(findAll('[role=dialog]')).toEqual([]);
    });

    test('keeps the draft and shows the message when the server refuses, without telling the client', async () => {
        recorded.onExecute((sql) => [{ kind: 'error', sql, error: { code: 'query-failed', message: 'duplicate column name: nickname' }, elapsedMs: 0 }]);
        await open('customers');
        await click(byText('button', 'Add column'));
        await type(nameFields()[2]!, 'nickname');
        await click(applyButton('Apply'));
        await click(byText('[role=dialog] button', 'Apply'));

        expect(document.body.textContent).toContain('duplicate column name: nickname');
        expect(changes).toEqual([]);
        expect(nameFields()).toHaveLength(3);
        expect(findAll('[role=dialog]')).toEqual([]);
    });

    test('a new table needs a name and a column before Create opens, then creates it and opens it for editing', async () => {
        await open(undefined);

        expect(applyButton('Create table').disabled).toBe(true);
        expect(preview()).toContain('The table needs a name.');

        await type(find('input[placeholder=table_name]') as HTMLInputElement, 'invoices');
        await click(byText('button', 'Add column'));
        await type(nameFields()[0]!, 'id');
        expect(preview()).toContain('CREATE TABLE "invoices" (');
        expect(applyButton('Create table').disabled).toBe(false);

        await click(applyButton('Create table'));
        await click(byText('[role=dialog] button', 'Create table'));

        expect(recorded.executed()).toHaveLength(1);
        expect(recorded.executed()[0]).toContain('CREATE TABLE "invoices"');
        expect(changes).toEqual([{ connectionId: 'one', schema: 'main' }]);
        expect(actions).toEqual([{ kind: 'edit-table', ref: { connectionId: 'one', schema: 'main', table: 'invoices' } }]);
    });

    test('warns before a column is dropped', async () => {
        await open('customers');
        await click(findAll('button[aria-label="Remove column"]')[1]!);
        await click(applyButton('Apply'));

        expect(find('[role=dialog]').textContent).toContain('A column is removed, and the data in it is lost.');
    });

    test('cannot be edited on a read only connection', async () => {
        await open('customers', { ...connection.config, readOnly: true });

        expect(document.body.textContent).toContain('This connection is read only.');
        expect(byText('button', 'Add column')).toHaveProperty('disabled', true);
        expect(nameFields().every((field) => field.disabled)).toBe(true);
    });
});
