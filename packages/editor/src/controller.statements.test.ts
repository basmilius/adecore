import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';

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
