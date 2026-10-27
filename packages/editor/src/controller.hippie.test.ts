import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';

describe('Hippie completion', () => {
    test('takes words from the sources the host handed over, one undo step per press', () => {
        const { editor } = mountEditor({ text: 'foo', language: 'typescript' });
        editor.setWordSources?.(() => ['foobar foobaz']);
        editor.setCaret({ line: 0, character: 3 });

        expect(editor.runCommand('hippieCompletion')).toBe(true);
        expect(editor.getText()).toBe('foobaz');
        expect(editor.runCommand('hippieCompletion')).toBe(true);
        expect(editor.getText()).toBe('foobar');

        editor.runCommand('undo');

        expect(editor.getText()).toBe('foobaz');
    });

    test('stops using sources that were taken away', () => {
        const { editor } = mountEditor({ text: 'foo', language: 'typescript' });
        editor.setWordSources?.(() => ['foobar']);
        editor.setWordSources?.(null);
        editor.setCaret({ line: 0, character: 3 });

        expect(editor.runCommand('hippieCompletion')).toBe(false);
        expect(editor.getText()).toBe('foo');
    });

    test('marks the word it took from this document until the next key', () => {
        const { editor, page, press } = mountEditor({ text: 'fooBar\nfoo', language: 'typescript' });
        editor.setCaret({ line: 1, character: 3 });
        editor.runCommand('hippieCompletion');

        expect(page.host.querySelectorAll('.se-hippie-source').length).toBeGreaterThan(0);

        press('ArrowLeft');

        expect(page.host.querySelectorAll('.se-hippie-source').length).toBe(0);
    });

    test('is refused in a read-only editor', () => {
        const { editor } = mountEditor({ text: 'foobar\nfoo', language: 'typescript', readOnly: true });
        editor.setCaret({ line: 1, character: 3 });

        expect(editor.runCommand('hippieCompletion')).toBe(false);
        expect(editor.getText()).toBe('foobar\nfoo');
    });
});
