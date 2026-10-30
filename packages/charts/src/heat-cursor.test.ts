import { expect, test } from 'bun:test';
import { createHeatmapCursor } from './heat-cursor.ts';

test('cursor snapshots stay stable until coordinates change and own their input', () => {
    const cursor = createHeatmapCursor();
    expect(cursor.getSnapshot()).toBeNull();
    const input = { row: 1, column: 2 };
    cursor.set(input);
    const selected = cursor.getSnapshot();
    expect(selected).toEqual(input);
    expect(selected).not.toBe(input);
    input.column = 3;
    expect(cursor.getSnapshot()).toEqual({ row: 1, column: 2 });
    cursor.set({ row: 1, column: 2 });
    expect(cursor.getSnapshot()).toBe(selected);
    expect(cursor.isActive({ row: 1, column: 2 })).toBe(true);
    cursor.set(null);
    expect(cursor.getSnapshot()).toBeNull();
});

test('a selection change notifies only its old and new cell plus the root', () => {
    const cursor = createHeatmapCursor();
    const a = { row: 0, column: 0 };
    const b = { row: 0, column: 1 };
    const aStates: boolean[] = [];
    const bStates: boolean[] = [];
    let other = 0;
    let roots = 0;
    cursor.subscribe(() => {
        roots += 1;
    });
    cursor.subscribeCell(a, () => aStates.push(cursor.isActive(a)));
    cursor.subscribeCell(b, () => bStates.push(cursor.isActive(b)));
    cursor.subscribeCell({ row: 1, column: 0 }, () => {
        other += 1;
    });
    cursor.set(a);
    cursor.set({ ...a });
    cursor.set(b);
    cursor.set(null);
    cursor.set(null);
    expect(aStates).toEqual([true, false]);
    expect(bStates).toEqual([true, false]);
    expect(roots).toBe(3);
    expect(other).toBe(0);
});

test('unsubscribed cells stop receiving updates and old cleanup cannot remove a replacement', () => {
    const cursor = createHeatmapCursor();
    const a = { row: 0, column: 0 };
    const b = { row: 1, column: 1 };
    let old = 0;
    let replacement = 0;
    let roots = 0;
    const stopRoot = cursor.subscribe(() => {
        roots += 1;
    });
    const stopOld = cursor.subscribeCell(a, () => {
        old += 1;
    });
    cursor.set(a);
    stopRoot();
    stopOld();
    const stopNew = cursor.subscribeCell(a, () => {
        replacement += 1;
    });
    stopOld();
    cursor.set(b);
    cursor.set(a);
    stopNew();
    cursor.set(b);
    expect(old).toBe(1);
    expect(roots).toBe(1);
    expect(replacement).toBe(2);
});
