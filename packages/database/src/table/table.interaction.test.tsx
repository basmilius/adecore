import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import { StructureView } from '../structure/StructureView.tsx';
import type { Mounted, RecordedTransport } from '../testing/dom/harness.tsx';
import { byLabel, byText, clientOver, click, find, findAll, mount, perform, recordTransport, waitFor } from '../testing/dom/harness.tsx';
import { SHOP_PATH, shopDatabase } from '../testing/dom/shop.ts';
import { fakeDatabaseTransport } from '../testing/index.ts';
import { TableView } from './TableView.tsx';

const connection: Connection = { id: 'one', name: 'Shop', config: { engine: 'sqlite', path: SHOP_PATH } };

describe.skipIf(typeof document === 'undefined')('the views of a table in a DOM, when the schema changes', () => {
    let recorded: RecordedTransport;
    let client: ReturnType<typeof clientOver>;
    let mounted: Mounted;

    const notify = (change: { connectionId: string; schema?: string }): Promise<void> => perform(() => client.notifySchemaChange(change));

    beforeEach(() => {
        recorded = recordTransport(fakeDatabaseTransport({ databases: { [SHOP_PATH]: shopDatabase } }));
        client = clientOver(recorded.transport);
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    describe('StructureView', () => {
        beforeEach(async () => {
            mounted = await mount(<StructureView connection={connection} schema="main" table="customers" />, { client });
            await waitFor(() => expect(findAll('[role=tab]')).toHaveLength(4));
        });

        test('loads the structure again for its connection and schema, and keeps it on screen meanwhile', async () => {
            expect(recorded.of('structure')).toHaveLength(1);
            await notify({ connectionId: 'one', schema: 'main' });
            expect(findAll('[role=tab]')).toHaveLength(4);
            await waitFor(() => expect(recorded.of('structure')).toHaveLength(2));
        });

        test('loads again for a change that names no schema', async () => {
            await notify({ connectionId: 'one' });
            await waitFor(() => expect(recorded.of('structure')).toHaveLength(2));
        });

        test('ignores a change of another connection or another schema', async () => {
            await notify({ connectionId: 'two', schema: 'main' });
            await notify({ connectionId: 'one', schema: 'other' });
            expect(recorded.of('structure')).toHaveLength(1);
        });
    });

    describe('TableView', () => {
        beforeEach(async () => {
            mounted = await mount(<TableView connection={connection} schema="main" table="customers" />, { client });
            await waitFor(() => expect(findAll('[role=gridcell]').length).toBeGreaterThan(0));
        });

        test('reads the structure and the page again, with no pending change', async () => {
            const structures = recorded.of('structure').length;
            const pages = recorded.of('rows').length;
            await notify({ connectionId: 'one', schema: 'main' });

            await waitFor(() => {
                expect(recorded.of('structure').length).toBeGreaterThan(structures);
                expect(recorded.of('rows').length).toBeGreaterThan(pages);
            });
            expect(findAll('[role=dialog]')).toEqual([]);
            expect(document.body.textContent).not.toContain('The table changed');
        });

        test('keeps the pending changes and offers a reload that asks before it discards them', async () => {
            await click(byLabel('Add row'));
            const rowsBefore = recorded.of('rows').length;
            await notify({ connectionId: 'one', schema: 'main' });

            expect(document.body.textContent).toContain('The table changed; reload to see it');
            expect(recorded.of('rows')).toHaveLength(rowsBefore);

            await click(byText('button', 'Reload'));
            expect(find('[role=dialog]').textContent).toContain('Discard the pending changes?');
            expect(recorded.of('rows')).toHaveLength(rowsBefore);

            await click(byText('[role=dialog] button', 'Discard changes'));
            await waitFor(() => expect(recorded.of('rows').length).toBeGreaterThan(rowsBefore));
            expect(document.body.textContent).not.toContain('The table changed');
        });

        test('ignores a change of another schema', async () => {
            const pages = recorded.of('rows').length;
            await notify({ connectionId: 'one', schema: 'other' });
            expect(recorded.of('rows')).toHaveLength(pages);
        });
    });
});
