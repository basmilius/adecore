import { describe, expect, test } from 'bun:test';
import { toolFileEdit } from './tool-edits.ts';

describe('toolFileEdit', () => {
    test('an Edit is one piece of its file', () => {
        expect(toolFileEdit('Edit', { file_path: '/a.ts', old_string: 'one', new_string: 'two' })).toEqual({
            path: '/a.ts',
            write: false,
            pieces: [{ before: 'one', after: 'two' }]
        });
    });

    test('a missing side of an Edit reads as empty text', () => {
        expect(toolFileEdit('Edit', { file_path: '/a.ts', new_string: 'two' })?.pieces).toEqual([{ before: '', after: 'two' }]);
        expect(toolFileEdit('Edit', { file_path: '/a.ts', old_string: 7 })?.pieces).toEqual([{ before: '', after: '' }]);
    });

    test('a Write replaces the file with its content', () => {
        expect(toolFileEdit('Write', { file_path: '/a.ts', content: 'body' })).toEqual({ path: '/a.ts', write: true, pieces: [{ before: '', after: 'body' }] });
        expect(toolFileEdit('Write', { file_path: '/a.ts' })?.pieces).toEqual([{ before: '', after: '' }]);
    });

    test('a MultiEdit keeps its edits in order and skips entries that are not objects', () => {
        const edit = toolFileEdit('MultiEdit', {
            file_path: '/a.ts',
            edits: [{ old_string: 'a', new_string: 'b' }, 'x', { old_string: 'c', new_string: 'd' }]
        });

        expect(edit).toEqual({
            path: '/a.ts',
            write: false,
            pieces: [
                { before: 'a', after: 'b' },
                { before: 'c', after: 'd' }
            ]
        });
        expect(toolFileEdit('MultiEdit', { file_path: '/a.ts', edits: [] })).toEqual({ path: '/a.ts', write: false, pieces: [] });
    });

    test('a call without a path, a MultiEdit without a list or another tool changes no file', () => {
        expect(toolFileEdit('Edit', { old_string: 'a', new_string: 'b' })).toBeNull();
        expect(toolFileEdit('MultiEdit', { file_path: '/a.ts', edits: 'nope' })).toBeNull();
        expect(toolFileEdit('Read', { file_path: '/a.ts' })).toBeNull();
        expect(toolFileEdit('Edit', null)).toBeNull();
        expect(toolFileEdit('Edit', 'x')).toBeNull();
    });
});
