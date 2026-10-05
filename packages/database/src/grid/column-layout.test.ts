import { describe, expect, test } from 'bun:test';
import { captureLayout, restoreLayout, sameLayout } from './column-layout.ts';

const columns = [{ name: 'id' }, { name: 'name' }, { name: 'email' }];

describe('restoreLayout', () => {
    test('maps the names of a layout onto the indexes of the columns', () => {
        const state = restoreLayout(columns, { widths: { email: 300, name: 150 }, hidden: ['id'], pinned: ['email'] });
        expect(state.resized).toEqual({ 1: 150, 2: 300 });
        expect([...state.view.hidden]).toEqual([0]);
        expect(state.view.pinned).toEqual([2]);
    });

    test('skips names the columns no longer have', () => {
        const state = restoreLayout(columns, { widths: { gone: 200 }, hidden: ['gone'], pinned: ['gone', 'name'] });
        expect(state.resized).toEqual({});
        expect(state.view.hidden.size).toBe(0);
        expect(state.view.pinned).toEqual([1]);
    });

    test('keeps a width within what a drag allows', () => {
        const state = restoreLayout(columns, { widths: { id: 4, name: 99999 }, hidden: [], pinned: [] });
        expect(state.resized).toEqual({ 0: 64, 1: 1200 });
    });

    test('hides no column when the layout would hide them all', () => {
        expect(restoreLayout(columns, { widths: {}, hidden: ['id', 'name', 'email'], pinned: [] }).view.hidden.size).toBe(0);
    });

    test('does not pin a hidden column', () => {
        expect(restoreLayout(columns, { widths: {}, hidden: ['name'], pinned: ['name', 'id'] }).view.pinned).toEqual([0]);
    });

    test('starts empty without a layout', () => {
        const state = restoreLayout(columns, undefined);
        expect(state.resized).toEqual({});
        expect(state.view.pinned).toEqual([]);
    });
});

describe('captureLayout', () => {
    test('writes the state with the names of the columns', () => {
        const layout = captureLayout(columns, { resized: { 2: 300, 0: 80 }, view: { hidden: new Set([1]), pinned: [2, 0] } });
        expect(layout).toEqual({ widths: { email: 300, id: 80 }, hidden: ['name'], pinned: ['email', 'id'] });
    });

    test('round trips through restoreLayout', () => {
        const layout = { widths: { name: 222 }, hidden: ['id'], pinned: ['email'] };
        expect(captureLayout(columns, restoreLayout(columns, layout))).toEqual(layout);
    });
});

describe('sameLayout', () => {
    test('compares widths, hidden and pinned', () => {
        const base = { widths: { id: 100 }, hidden: ['a'], pinned: ['b'] };
        expect(sameLayout(base, { widths: { id: 100 }, hidden: ['a'], pinned: ['b'] })).toBe(true);
        expect(sameLayout(base, { ...base, widths: { id: 101 } })).toBe(false);
        expect(sameLayout(base, { ...base, hidden: [] })).toBe(false);
        expect(sameLayout(base, { ...base, pinned: ['c'] })).toBe(false);
    });
});
