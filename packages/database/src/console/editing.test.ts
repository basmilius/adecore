import { describe, expect, test } from 'bun:test';
import { applyEdit, indentEdit, newlineEdit, outdentEdit } from './editing.ts';

const run = (edit: ReturnType<typeof indentEdit>, value: string): { value: string; selection: [number, number] } => ({
    value: applyEdit(value, edit),
    selection: [edit.selectionStart, edit.selectionEnd]
});

describe('indentEdit', () => {
    test('inserts four spaces at the caret', () => {
        expect(run(indentEdit('ab', 1, 1), 'ab')).toEqual({ value: 'a    b', selection: [5, 5] });
    });

    test('replaces a selection inside one line', () => {
        expect(run(indentEdit('abcd', 1, 3), 'abcd')).toEqual({ value: 'a    d', selection: [5, 5] });
    });

    test('indents every line a selection spans and keeps the selection on the same text', () => {
        const value = 'one\ntwo\nthree';
        const result = run(indentEdit(value, 2, 9), value);
        expect(result.value).toBe('    one\n    two\n    three');
        expect(result.value.slice(result.selection[0], result.selection[1])).toBe('e\n    two\n    t');
    });

    test('leaves out a last line the selection only reaches the start of', () => {
        const value = 'one\ntwo\nthree';
        expect(applyEdit(value, indentEdit(value, 0, 8))).toBe('    one\n    two\nthree');
    });

    test('does not pad an empty line', () => {
        const value = 'one\n\ntwo';
        expect(applyEdit(value, indentEdit(value, 0, value.length))).toBe('    one\n\n    two');
    });
});

describe('outdentEdit', () => {
    test('takes four spaces off the line of the caret', () => {
        const value = '        two';
        const result = run(outdentEdit(value, 10, 10)!, value);
        expect(result).toEqual({ value: '    two', selection: [6, 6] });
    });

    test('takes only the spaces there are, or a tab', () => {
        expect(applyEdit('  a', outdentEdit('  a', 3, 3)!)).toBe('a');
        expect(applyEdit('\ta', outdentEdit('\ta', 2, 2)!)).toBe('a');
    });

    test('outdents every line of a selection', () => {
        const value = '    one\n    two\nthree';
        const edit = outdentEdit(value, 0, 15)!;
        expect(applyEdit(value, edit)).toBe('one\ntwo\nthree');
        expect([edit.selectionStart, edit.selectionEnd]).toEqual([0, 7]);
    });

    test('keeps the caret in the line when it sat in the indentation', () => {
        expect(outdentEdit('    a', 2, 2)).toMatchObject({ selectionStart: 0, selectionEnd: 0 });
    });

    test('is null when there is nothing to take off', () => {
        expect(outdentEdit('one\ntwo', 0, 7)).toBeNull();
    });
});

describe('newlineEdit', () => {
    test('keeps the indentation of the line', () => {
        expect(run(newlineEdit('    foo', 7, 7), '    foo')).toEqual({ value: '    foo\n    ', selection: [12, 12] });
    });

    test('splits a line and indents the rest', () => {
        expect(applyEdit('  ab', newlineEdit('  ab', 3, 3))).toBe('  a\n  b');
    });

    test('takes only the indentation before the caret', () => {
        expect(applyEdit('    ab', newlineEdit('    ab', 2, 2))).toBe('  \n    ab');
    });

    test('replaces a selection', () => {
        expect(applyEdit('a bc', newlineEdit('a bc', 1, 3))).toBe('a\nc');
    });

    test('starts a plain line when the line has no indentation', () => {
        expect(applyEdit('ab', newlineEdit('ab', 2, 2))).toBe('ab\n');
    });

    test('uses tabs as they are', () => {
        expect(applyEdit('\tab', newlineEdit('\tab', 3, 3))).toBe('\tab\n\t');
    });
});
