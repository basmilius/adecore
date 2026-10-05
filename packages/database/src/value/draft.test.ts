import { describe, expect, test } from 'bun:test';
import type { GridColumn } from '../grid/types.ts';
import { editValueOf, sameDraft, sameSource, sourceOf } from './draft.ts';

const column = (kind: GridColumn['kind'], extra: Partial<GridColumn> = {}): GridColumn => ({ name: 'c', type: '', kind, ...extra });

describe('sourceOf', () => {
    test('starts from the text of the value', () => {
        expect(sourceOf(column('integer'), 42).original).toEqual({ text: '42', mode: 'value' });
        expect(sourceOf(column('text'), null).original).toEqual({ text: '', mode: 'null' });
        expect(sourceOf(column('binary'), { kind: 'binary', hex: 'ab' }).original).toEqual({ text: 'ab', mode: 'value' });
    });

    test('detects JSON by column kind or by the text', () => {
        expect(sourceOf(column('json'), 'not json').json).toBe(true);
        expect(sourceOf(column('json'), null).json).toBe(false);
        expect(sourceOf(column('text'), '{"a":1}').json).toBe(true);
        expect(sourceOf(column('text'), '42').json).toBe(false);
    });

    test('treats a binary column as binary even when it is NULL', () => {
        expect(sourceOf(column('binary'), null).binary).toBe(true);
    });

    test('tells the same source from another', () => {
        expect(sameSource(sourceOf(column('text'), 'a'), sourceOf(column('text'), 'a'))).toBe(true);
        expect(sameSource(sourceOf(column('text'), 'a'), sourceOf(column('text'), 'b'))).toBe(false);
        expect(sameSource(sourceOf(column('text'), 'a'), sourceOf(column('text', { name: 'd' }), 'a'))).toBe(false);
    });
});

describe('sameDraft', () => {
    test('ignores the text of a NULL', () => {
        expect(sameDraft({ text: 'x', mode: 'null' }, { text: '', mode: 'null' })).toBe(true);
        expect(sameDraft({ text: 'x', mode: 'value' }, { text: 'y', mode: 'value' })).toBe(false);
    });
});

describe('editValueOf', () => {
    const convert = (kind: GridColumn['kind'], value: Parameters<typeof sourceOf>[1], text: string) => {
        const source = sourceOf(column(kind), value);
        return editValueOf({ text, mode: 'value' }, source);
    };

    test('sends text as a string and keeps its newlines', () => {
        expect(convert('text', 'a', 'one\ntwo ')).toEqual({ ok: true, value: 'one\ntwo ' });
    });

    test('sends a number only for a numeric column and a plain number', () => {
        expect(convert('integer', 1, '42')).toEqual({ ok: true, value: 42 });
        expect(convert('integer', 1, '4.5')).toEqual({ ok: true, value: '4.5' });
        expect(convert('float', 1, '4.5')).toEqual({ ok: true, value: 4.5 });
        expect(convert('text', 'a', '42')).toEqual({ ok: true, value: '42' });
        expect(convert('decimal', '1.10', '1.10')).toEqual({ ok: true, value: '1.10' });
    });

    test('sends binary as hex and refuses what is not hex', () => {
        expect(convert('binary', { kind: 'binary', hex: '00' }, 'DE AD')).toEqual({ ok: true, value: { kind: 'binary', hex: 'dead' } });
        expect(convert('binary', { kind: 'binary', hex: '00' }, 'zz')).toEqual({ ok: false, problem: { kind: 'hex', problem: 'characters' } });
        expect(convert('binary', { kind: 'binary', hex: '00' }, 'abc')).toEqual({ ok: false, problem: { kind: 'hex', problem: 'odd' } });
    });

    test('refuses invalid JSON and sends valid JSON as typed', () => {
        const bad = convert('json', '{}', '{"a":');
        expect(bad.ok).toBe(false);
        expect(bad.ok ? null : bad.problem.kind).toBe('json');
        expect(convert('json', '{}', '{ "a": 1 }')).toEqual({ ok: true, value: '{ "a": 1 }' });
    });

    test('sends NULL and DEFAULT without looking at the text', () => {
        const source = sourceOf(column('json'), '{}');
        expect(editValueOf({ text: '{bad', mode: 'null' }, source)).toEqual({ ok: true, value: null });
        expect(editValueOf({ text: '', mode: 'default' }, source)).toEqual({ ok: true, value: { kind: 'default' } });
    });
});
