import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';

describe('cleaning up whitespace before a save', () => {
    test('strips the lines changed since the last save, keeps the caret line and counts again from the save', () => {
        const { editor } = mountEditor({ text: 'a  \nb  \nc  ', language: 'typescript' });
        editor.markSaved!();
        editor.applyEdits([{ range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } }, text: 'B' }]);
        editor.applyEdits([{ range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } }, text: 'C' }]);
        editor.setCaret({ line: 2, character: 0 });

        expect(editor.cleanUpWhitespace!({ trailingWhitespace: 'modified' })).toBe(true);
        expect(editor.getText()).toBe('a  \nB\nC  ');

        editor.setCaret({ line: 0, character: 0 });

        expect(editor.cleanUpWhitespace!({ trailingWhitespace: 'modified' })).toBe(false);
        expect(editor.getText()).toBe('a  \nB\nC  ');
    });

    test('changes nothing in a read-only editor', () => {
        const { editor } = mountEditor({ text: 'a  ', readOnly: true });

        expect(editor.cleanUpWhitespace!({ trailingWhitespace: 'all', keepCaretLines: false })).toBe(false);
        expect(editor.getText()).toBe('a  ');
    });
});
