import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Mounted } from '../testing/dom/harness.tsx';
import { clientOver, find, mount, perform } from '../testing/dom/harness.tsx';
import { fakeDatabaseTransport } from '../testing/index.ts';
import * as display from './display.ts';
import type { GridColumn, GridRow } from './types.ts';

/* Every cell the grid draws goes through `cellView` once, so its calls count the cells a render rebuilds. */
let drawnCells = 0;
const realCellView = display.cellView;
mock.module('./display.ts', () => ({
    ...display,
    cellView: (...args: Parameters<typeof realCellView>) => {
        drawnCells++;
        return realCellView(...args);
    }
}));
const { DataGrid } = await import('./DataGrid.tsx');
const { HEADER_HEIGHT, ROW_BLOCK, ROW_HEIGHT } = await import('./layout.ts');

const COLUMNS = 20;
const columns: GridColumn[] = Array.from({ length: COLUMNS }, (_, index) => ({ name: `c${index}`, type: 'TEXT', kind: 'text' }));
const rows: GridRow[] = Array.from({ length: 2000 }, (_, index) => ({
    key: `row:${index}`,
    number: index + 1,
    cells: columns.map((column) => `${column.name}:${index}`)
}));

const scrollTo = (top: number): Promise<void> =>
    perform(() => {
        const grid = find('[role=grid]');
        grid.scrollTop = top;
        grid.dispatchEvent(new Event('scroll'));
    });

describe.skipIf(typeof document === 'undefined')('scrolling a DataGrid', () => {
    let mounted: Mounted;
    let client: ReturnType<typeof clientOver>;

    beforeEach(async () => {
        client = clientOver(fakeDatabaseTransport({ databases: {} }));
        mounted = await mount(<DataGrid label="Numbers" columns={columns} rows={rows} />, { client });
        drawnCells = 0;
    });

    afterEach(async () => {
        await mounted.unmount();
        await client.dispose();
    });

    test('redraws nothing while the top stays in the same block of rows', async () => {
        for (let row = 1; row < ROW_BLOCK; row++) {
            await scrollTo(HEADER_HEIGHT + row * ROW_HEIGHT);
        }
        expect(drawnCells).toBe(0);
    });

    test('draws only the rows that come into the window when it moves a block, never the ones already drawn', async () => {
        await scrollTo(HEADER_HEIGHT + ROW_BLOCK * ROW_HEIGHT);
        expect(drawnCells).toBeGreaterThan(0);
        expect(drawnCells).toBeLessThanOrEqual(ROW_BLOCK * COLUMNS);
    });

    test('keeps a viewport of rows drawn on each side of the one in view', async () => {
        await scrollTo(HEADER_HEIGHT + 10 * ROW_BLOCK * ROW_HEIGHT);
        const drawn = [...document.querySelectorAll('[role=row][aria-rowindex]')]
            .map((row) => Number(row.getAttribute('aria-rowindex')) - 2)
            .filter((index) => index >= 0);
        const top = 10 * ROW_BLOCK;
        const page = Math.ceil(600 / ROW_HEIGHT);
        expect(Math.min(...drawn)).toBeLessThanOrEqual(top - page);
        expect(Math.max(...drawn)).toBeGreaterThanOrEqual(top + 2 * page);
    });
});
