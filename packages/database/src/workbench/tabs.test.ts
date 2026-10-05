import { describe, expect, test } from 'bun:test';
import {
    closeTab,
    emptyState,
    focusTab,
    openConsole,
    openDesigner,
    openTable,
    parseState,
    pruneTabs,
    serializeState,
    setConsoleSql,
    setDesignerTable,
    setTableView
} from './tabs.ts';

const orders = { connectionId: 'shop', schema: 'main', table: 'orders' };
const items = { connectionId: 'shop', schema: 'main', table: 'items' };

describe('opening tabs', () => {
    test('opens a table once and brings it forward on the next open', () => {
        const first = openTable(emptyState, orders, 'data');
        const both = openTable(first, items, 'data');
        const again = openTable(both, orders, 'structure');
        expect(again.tabs).toHaveLength(2);
        expect(again.activeId).toBe(again.tabs[0]!.id);
        expect(again.tabs[0]).toMatchObject({ kind: 'table', view: 'structure' });
    });

    test('opens a filtered table in a tab of its own, every time', () => {
        const plain = openTable(emptyState, orders, 'data');
        const one = openTable(plain, orders, 'data', 'id = 1');
        const two = openTable(one, orders, 'data', 'id = 1');
        expect(two.tabs).toHaveLength(3);
        expect(new Set(two.tabs.map((tab) => tab.id)).size).toBe(3);
        expect(two.tabs[2]).toMatchObject({ where: 'id = 1' });
    });

    test('takes a blank filter for none', () => {
        expect(openTable(openTable(emptyState, orders, 'data'), orders, 'data', '  ').tabs).toHaveLength(1);
    });

    test('numbers consoles in the order they open, and keeps the sql it was opened with', () => {
        const state = openConsole(openConsole(emptyState, 'shop', 'main'), 'shop', undefined, 'select 1');
        expect(state.tabs.map((tab) => (tab.kind === 'console' ? tab.number : 0))).toEqual([1, 2]);
        expect(state.tabs[1]).toMatchObject({ sql: 'select 1' });
    });

    test('designs a table in one tab and a new table in a tab each', () => {
        const edit = openDesigner(openDesigner(emptyState, 'shop', 'main', 'orders'), 'shop', 'main', 'orders');
        expect(edit.tabs).toHaveLength(1);
        const fresh = openDesigner(openDesigner(edit, 'shop', 'main'), 'shop', 'main');
        expect(fresh.tabs).toHaveLength(3);
    });
});

describe('changing tabs', () => {
    test('sets the view of a table tab and the text of a console, and ignores a tab that is gone', () => {
        const state = openConsole(openTable(emptyState, orders, 'data'), 'shop');
        const [table, console] = state.tabs;
        const next = setConsoleSql(setTableView(state, table!.id, 'structure'), console!.id, 'select 2');
        expect(next.tabs[0]).toMatchObject({ view: 'structure' });
        expect(next.tabs[1]).toMatchObject({ sql: 'select 2' });
        expect(setTableView(state, 'nope', 'structure')).toBe(state);
        expect(setConsoleSql(state, table!.id, 'x')).toBe(state);
    });

    test('turns the designer of a new table into the designer of that table, without a second tab for it', () => {
        const state = openDesigner(openDesigner(emptyState, 'shop', 'main', 'orders'), 'shop', 'main');
        const fresh = state.tabs[1]!;
        const saved = setDesignerTable(state, fresh.id, 'orders');
        expect(saved.tabs).toHaveLength(1);
        expect(saved.tabs[0]).toMatchObject({ id: fresh.id, table: 'orders' });
    });

    test('focus ignores a tab that does not exist', () => {
        const state = openTable(emptyState, orders, 'data');
        expect(focusTab(state, 'nope')).toBe(state);
    });
});

describe('closing tabs', () => {
    const three = openTable(openTable(openTable(emptyState, orders, 'data'), items, 'data'), { ...orders, table: 'users' }, 'data');

    test('brings the next tab forward when the one in front closes, else the one before', () => {
        const [first, second, third] = three.tabs;
        expect(closeTab(focusTab(three, second!.id), second!.id).activeId).toBe(third!.id);
        expect(closeTab(three, third!.id).activeId).toBe(second!.id);
        expect(closeTab(focusTab(three, first!.id), first!.id).activeId).toBe(second!.id);
    });

    test('keeps the tab in front when another one closes', () => {
        const [first, , third] = three.tabs;
        expect(closeTab(three, first!.id).activeId).toBe(third!.id);
    });

    test('ends with nothing in front', () => {
        const only = openTable(emptyState, orders, 'data');
        expect(closeTab(only, only.tabs[0]!.id).activeId).toBeNull();
    });

    test('prunes the tabs of connections that are gone', () => {
        const mixed = openConsole(openTable(emptyState, orders, 'data'), 'other');
        const pruned = pruneTabs(mixed, new Set(['shop']));
        expect(pruned.tabs).toHaveLength(1);
        expect(pruned.activeId).toBe(pruned.tabs[0]!.id);
        expect(pruneTabs(pruned, new Set(['shop']))).toBe(pruned);
    });
});

describe('persisting tabs', () => {
    test('reads back what it wrote, and goes on counting where it stopped', () => {
        const state = openDesigner(openConsole(openTable(emptyState, orders, 'structure', 'id > 1'), 'shop', 'main', 'select 1'), 'shop', 'main');
        const read = parseState(serializeState(state));
        expect(read).toEqual(state);
        expect(openConsole(read, 'shop').tabs.at(-1)).toMatchObject({ number: 2 });
        expect(new Set(openConsole(read, 'shop').tabs.map((tab) => tab.id)).size).toBe(4);
    });

    test('starts empty from nothing, from text that is not json and from another version', () => {
        expect(parseState(null)).toEqual(emptyState);
        expect(parseState('{')).toEqual(emptyState);
        expect(parseState('null')).toEqual(emptyState);
        expect(parseState(JSON.stringify({ version: 2, tabs: [] }))).toEqual(emptyState);
    });

    test('leaves out a tab that is not valid and keeps the others', () => {
        const raw = JSON.stringify({
            version: 1,
            tabs: [
                { id: 'a', kind: 'table', ref: orders, view: 'data' },
                { id: 'b', kind: 'table', ref: { connectionId: 'shop' }, view: 'data' },
                { id: 'c', kind: 'unknown' },
                { id: 'a', kind: 'console', connectionId: 'shop', sql: '', number: 1 },
                { id: 'console:4', kind: 'console', connectionId: 'shop', sql: '', number: 3 }
            ],
            activeId: 'gone'
        });
        const read = parseState(raw);
        expect(read.tabs.map((tab) => tab.id)).toEqual(['a', 'console:4']);
        expect(read.activeId).toBe('console:4');
        expect(read.serial).toBe(4);
        expect(read.consoles).toBe(3);
    });
});
