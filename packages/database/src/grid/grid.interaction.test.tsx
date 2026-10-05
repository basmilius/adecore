import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Mounted } from '../testing/dom/harness.tsx';
import { byText, clientOver, click, contextMenu, findAll, mount, perform } from '../testing/dom/harness.tsx';
import { fakeDatabaseTransport } from '../testing/index.ts';
import { DataGrid } from './DataGrid.tsx';
import type { GridColumn, GridRow } from './types.ts';

const columns: GridColumn[] = [
    { name: 'id', type: 'INTEGER', kind: 'integer' },
    { name: 'name', type: 'TEXT', kind: 'text' }
];

const rows: GridRow[] = [
    { key: 'row:0', number: 1, cells: [1, 'Ada'] },
    { key: 'row:1', number: 2, cells: [2, 'Grace'] }
];

const rowHeaders = (): HTMLElement[] => findAll('[role=rowheader]');
const columnHeaders = (): HTMLElement[] => findAll('[role=columnheader]');
const selectedRows = (): string[] => findAll('[role=row][aria-selected=true]').map((row) => row.getAttribute('aria-rowindex') ?? '');

/* The menu closes on the press in a browser, so the click that follows lands on whatever lay under the pointer. */
const pressIn = (element: Element): Promise<void> =>
    perform(() => {
        element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });

describe.skipIf(typeof document === 'undefined')('DataGrid in a DOM', () => {
    let mounted: Mounted;
    let client: ReturnType<typeof clientOver>;

    beforeEach(async () => {
        client = clientOver(fakeDatabaseTransport({ databases: {} }));
        mounted = await mount(<DataGrid label="Customers" columns={columns} rows={rows} />, { client });
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    test('selects a row by its number', async () => {
        await click(rowHeaders()[1]!);
        expect(selectedRows()).toEqual(['3']);
    });

    test('does not select the row under the pointer when a click follows a press in the menu', async () => {
        await contextMenu(findAll('[role=gridcell]')[0]!);
        await pressIn(findAll('[role=menuitem]')[0]!);
        await click(rowHeaders()[1]!);
        expect(selectedRows()).toEqual([]);

        await pressIn(rowHeaders()[1]!);
        await click(rowHeaders()[1]!);
        expect(selectedRows()).toEqual(['3']);
    });

    test('does not select the column under the pointer when a click follows a press in the menu', async () => {
        await contextMenu(columnHeaders()[0]!.firstElementChild!);
        await pressIn(byText('[role=menuitem]', 'Copy column name'));
        await click(columnHeaders()[1]!);
        expect(columnHeaders().map((header) => header.getAttribute('aria-selected'))).toEqual(['false', 'false']);

        await pressIn(columnHeaders()[1]!);
        await click(columnHeaders()[1]!);
        expect(columnHeaders().map((header) => header.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    });
});
