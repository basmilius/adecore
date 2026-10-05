import { describe, expect, test } from 'bun:test';
import type { GridColumn } from '../grid/types.ts';
import { sourceOf } from './draft.ts';
import { renderView, sizeOf, viewsOf } from './views.ts';

const column = (kind: GridColumn['kind']): GridColumn => ({ name: 'c', type: '', kind });

describe('viewsOf', () => {
    test('opens text in the text view', () => {
        const source = sourceOf(column('text'), 'a');
        expect(viewsOf(source, source.original)).toEqual(['text']);
    });

    test('opens JSON formatted, with the text beside it', () => {
        const source = sourceOf(column('json'), '{}');
        expect(viewsOf(source, source.original)).toEqual(['formatted', 'text']);
    });

    test('offers a UUID for exactly 16 bytes', () => {
        const uuid = sourceOf(column('binary'), { kind: 'binary', hex: '00'.repeat(16) });
        const short = sourceOf(column('binary'), { kind: 'binary', hex: '00'.repeat(15) });
        expect(viewsOf(uuid, uuid.original)).toEqual(['hex', 'utf8', 'uuid']);
        expect(viewsOf(short, short.original)).toEqual(['hex', 'utf8']);
    });
});

describe('sizeOf', () => {
    test('counts characters of text and bytes of binary', () => {
        const text = sourceOf(column('text'), 'héllo');
        const binary = sourceOf(column('binary'), { kind: 'binary', hex: 'aabb' });
        expect(sizeOf(text, text.original)).toEqual({ unit: 'characters', count: 5 });
        expect(sizeOf(binary, binary.original)).toEqual({ unit: 'bytes', count: 2 });
        expect(sizeOf(binary, { text: 'zz', mode: 'value' })).toBeNull();
        expect(sizeOf(text, { text: '', mode: 'null' })).toBeNull();
    });
});

describe('renderView', () => {
    test('formats JSON, or says why it cannot', () => {
        expect(renderView('formatted', { text: '[1]', mode: 'value' })).toEqual({ kind: 'text', text: '[\n  1\n]' });
        expect(renderView('formatted', { text: '[1', mode: 'value' }).kind).toBe('problem');
    });

    test('decodes bytes, and writes a UUID', () => {
        expect(renderView('utf8', { text: '6869', mode: 'value' })).toEqual({ kind: 'text', text: 'hi' });
        expect(renderView('uuid', { text: '550e8400e29b41d4a716446655440000', mode: 'value' })).toEqual({
            kind: 'text',
            text: '550e8400-e29b-41d4-a716-446655440000'
        });
    });

    test('marks a dump that stops short', () => {
        const rendered = renderView('hex', { text: '00'.repeat(20 * 1024), mode: 'value' });
        expect(rendered.kind === 'text' ? rendered.truncated : null).toEqual({ shown: 16 * 1024, total: 20 * 1024 });
    });

    test('has nothing to lay out for NULL', () => {
        expect(renderView('hex', { text: '', mode: 'null' })).toEqual({ kind: 'empty' });
    });
});
