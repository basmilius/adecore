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

const wide: GridColumn[] = [
    { name: 'id', type: 'INTEGER', kind: 'integer' },
    { name: 'name', type: 'TEXT', kind: 'text' },
    { name: 'email', type: 'TEXT', kind: 'text' },
    { name: 'city', type: 'TEXT', kind: 'text' }
];

const widthOf = (element: Element): number => Number.parseFloat((element as HTMLElement).style.width);

describe.skipIf(typeof document === 'undefined')('DataGrid with pinned columns', () => {
    let mounted: Mounted;
    let client: ReturnType<typeof clientOver>;

    beforeEach(async () => {
        client = clientOver(fakeDatabaseTransport({ databases: {} }));
        mounted = await mount(
            <DataGrid
                label="Customers"
                columns={wide}
                rows={[
                    { key: 'row:0', number: 1, cells: [1, 'Ada', 'ada@example.com', 'London'] },
                    { key: 'row:1', number: 2, cells: [2, 'Grace', 'grace@example.com', 'Arlington'] }
                ]}
                initialLayout={{ widths: { email: 201 }, hidden: [], pinned: ['email', 'name'] }}
            />,
            { client }
        );
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    test('stick with the gutter as one block in every row and the header, so no offset can drift', () => {
        const [header, first, second] = findAll('[role=row]');
        const blockOf = (line: Element | undefined): HTMLElement[] => [...(line!.firstElementChild as HTMLElement).children] as HTMLElement[];
        expect((header!.firstElementChild as HTMLElement).className).toContain('sticky left-0');
        expect(blockOf(header).map((part) => part.textContent)).toEqual(['', 'email', 'name']);
        expect(blockOf(first).map((part) => part.textContent)).toEqual(['1', 'ada@example.com', 'Ada']);
        expect(blockOf(second).map((part) => part.textContent)).toEqual(['2', 'grace@example.com', 'Grace']);
        // Every part of the block has the width of its column, the same in the header and the rows, and the rest follows the block.
        for (const line of [header, first, second]) {
            expect(blockOf(line).map(widthOf)).toEqual(blockOf(header).map(widthOf));
        }
        expect(widthOf(blockOf(header)[1]!)).toBe(201);
        expect(header!.children[1]?.textContent).toBe('id');
        expect(first!.children[1]?.textContent).toBe('1');
        for (const cell of [...findAll('[role=gridcell]'), ...findAll('[role=columnheader]'), ...findAll('[role=rowheader]')]) {
            expect(cell.style.left).toBe('');
        }
    });

    test('paint the gutter and the pinned columns under their own line, so nothing that scrolls shows through it', () => {
        const pinned = findAll('[role=row]').flatMap((line) => [...(line.firstElementChild as HTMLElement).children]);
        expect(pinned.length).toBe(9);
        for (const part of pinned) {
            expect(part.className).toContain('bg-clip-border');
        }
        const scrolling = findAll('[role=gridcell]').filter((cell) => !pinned.includes(cell));
        expect(scrolling.length).toBe(4);
        for (const cell of scrolling) {
            expect(cell.className).not.toContain('bg-clip-border');
        }
    });
});
