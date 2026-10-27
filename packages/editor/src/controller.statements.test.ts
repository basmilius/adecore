import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';

describe('Move Statement', () => {
    test('swaps statements, takes the extent a server folds, and goes back with one undo', () => {
        const { editor } = mountEditor({ text: 'foo\nbar\nbaz', language: 'typescript' });
        editor.setFoldHints({ ranges: [{ startLine: 0, endLine: 1 }] });
        editor.setCaret({ line: 0, character: 1 });

        expect(editor.runCommand('moveStatementDown')).toBe(true);
        expect(editor.getText()).toBe('baz\nfoo\nbar');
        expect(editor.getCaret()).toEqual({ line: 1, character: 1 });

        editor.runCommand('undo');

        expect(editor.getText()).toBe('foo\nbar\nbaz');
    });

    test('is refused in a read-only editor', () => {
        const { editor } = mountEditor({ text: 'a();\nb();', language: 'typescript', readOnly: true });

        expect(editor.runCommand('moveStatementDown')).toBe(false);
        expect(editor.getText()).toBe('a();\nb();');
    });
});

describe('Complete Current Statement', () => {
    test('completes the statement with one step of the undo history', () => {
        const { editor } = mountEditor({ text: 'if (a', language: 'typescript' });
        editor.setCaret({ line: 0, character: 5 });

        editor.runCommand('completeCurrentStatement');

        expect(editor.getText()).toBe('if (a) {\n    \n}');
        expect(editor.getCaret()).toEqual({ line: 1, character: 4 });

        editor.runCommand('undo');

        expect(editor.getText()).toBe('if (a');
    });

    test('is refused in a read-only editor', () => {
        const { editor } = mountEditor({ text: 'foo(a', language: 'typescript', readOnly: true });
        editor.setCaret({ line: 0, character: 5 });

        expect(editor.runCommand('completeCurrentStatement')).toBe(false);
        expect(editor.getText()).toBe('foo(a');
    });
});
