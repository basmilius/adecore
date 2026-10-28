import { afterEach, describe, expect, test } from 'bun:test';
import { rememberCopy } from './controller.ts';
import type { EditorCopy } from './types.ts';
import { mountEditor } from './testing.ts';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function stubClipboard(readText: () => Promise<string>): void {
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { readText } }, configurable: true });
}

afterEach(() => {
    if (navigatorDescriptor === undefined) {
        Reflect.deleteProperty(globalThis, 'navigator');
    } else {
        Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    }
});

describe('onCopy', () => {
    test('tells what a copy and a cut put on the clipboard', () => {
        const { editor, clip } = mountEditor({ text: 'one\ntwo' });
        const copies: EditorCopy[] = [];
        const off = editor.onCopy?.((copy) => copies.push(copy));

        clip('copy');
        clip('cut');
        off?.();
        clip('copy');

        expect(copies).toEqual([
            { text: 'one\n', wholeLines: true, cut: false },
            { text: 'one\n', wholeLines: true, cut: true }
        ]);
    });

    test('tells a cut that a read-only editor refuses as a copy', () => {
        const { editor, clip } = mountEditor({ text: 'one\ntwo', readOnly: true });
        const copies: EditorCopy[] = [];
        editor.onCopy?.((copy) => copies.push(copy));

        clip('cut');

        expect(copies).toEqual([{ text: 'one\n', wholeLines: true, cut: false }]);
        expect(editor.getText()).toBe('one\ntwo');
    });

    test('says a copy of a selection is no whole line', () => {
        const { editor, press, clip } = mountEditor({ text: 'one\ntwo' });
        const copies: EditorCopy[] = [];
        editor.onCopy?.((copy) => copies.push(copy));

        press('a', { ctrlKey: true });
        clip('copy');

        expect(copies).toEqual([{ text: 'one\ntwo', wholeLines: false, cut: false }]);
    });
});

describe('paste', () => {
    test('puts the text at every caret as a paste from the clipboard does', () => {
        const { editor } = mountEditor({ text: 'a\nb\nc', language: 'plaintext' });
        editor.setSelections?.([
            { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } },
            { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } }
        ]);

        expect(editor.paste?.('x\ny')).toBe(true);
        expect(editor.getText()).toBe('ax\nby\nc');
    });

    test('pastes whole lines above the line of a bare caret, and indents the text unless told not to', () => {
        const { editor } = mountEditor({ text: 'function f() {\n    \n}', language: 'typescript' });
        editor.setCaret({ line: 1, character: 4 });

        editor.paste?.('a();\nb();', { reindent: false });

        expect(editor.getText()).toBe('function f() {\n    a();\nb();\n}');

        const lines = mountEditor({ text: 'one\ntwo' }).editor;
        lines.setCaret({ line: 1, character: 1 });
        lines.paste?.('new\n', { wholeLines: true });

        expect(lines.getText()).toBe('one\nnew\ntwo');
    });

    test('is refused in a read-only editor', () => {
        const { editor } = mountEditor({ text: 'a', readOnly: true });

        expect(editor.paste?.('x')).toBe(false);
        expect(editor.getText()).toBe('a');
    });
});

describe('rememberCopy', () => {
    test('makes a text paste back as whole lines, and another text stop being one', () => {
        const { editor, clip } = mountEditor({ text: 'one\ntwo' });
        editor.setCaret({ line: 1, character: 1 });

        rememberCopy('new\n', true);
        clip('paste', 'new\n');

        expect(editor.getText()).toBe('one\nnew\ntwo');

        rememberCopy('new\n', false);
        clip('paste', 'new\n');

        expect(editor.getText()).toBe('one\nnew\ntnew\nwo');
    });
});

describe('Paste as Plain Text', () => {
    test('pastes the clipboard without moving the text to the indentation of its line', async () => {
        const { editor } = mountEditor({ text: 'function f() {\n    \n}', language: 'typescript' });
        stubClipboard(() => Promise.resolve('a();\nb();'));
        editor.setCaret({ line: 1, character: 4 });

        expect(editor.runCommand('pasteAsPlainText')).toBe(true);

        await Promise.resolve();
        await Promise.resolve();

        expect(editor.getText()).toBe('function f() {\n    a();\nb();\n}');
    });

    test('does nothing when the clipboard cannot be read', async () => {
        const { editor } = mountEditor({ text: 'a' });

        expect(editor.runCommand('pasteAsPlainText')).toBe(false);

        stubClipboard(() => Promise.reject(new Error('denied')));

        expect(editor.runCommand('pasteAsPlainText')).toBe(true);

        await Promise.resolve();
        await Promise.resolve();

        expect(editor.getText()).toBe('a');
    });

    test('is refused in a read-only editor', () => {
        const { editor } = mountEditor({ text: 'a', readOnly: true });
        stubClipboard(() => Promise.resolve('x'));

        expect(editor.runCommand('pasteAsPlainText')).toBe(false);
    });
});
