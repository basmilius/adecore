import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { WhitespaceCleanupOptions } from './whitespace-cleanup.ts';

function cleaned(text: string, options: WhitespaceCleanupOptions & { language?: string }, caret = 0): string {
    const model = new DocumentModel(text);
    model.markSaved();
    model.setSelections([{ anchor: caret, head: caret }]);
    model.cleanUpWhitespace(options);

    return model.getText();
}

describe('cleaning up whitespace on save', () => {
    it('does nothing by default', () => {
        expect(cleaned('a  \n\n\nb', {})).toBe('a  \n\n\nb');
    });

    it('strips the trailing spaces and tabs of every line, but not of the line the caret is on', () => {
        expect(cleaned('a  \nb\t \nc ', { trailingWhitespace: 'all' }, 1)).toBe('a  \nb\nc');
        expect(cleaned('a  \nb\t \nc ', { trailingWhitespace: 'all', keepCaretLines: false }, 1)).toBe('a\nb\nc');
    });

    it('strips only the lines changed since the last save in modified mode, undo included', () => {
        const model = new DocumentModel('a  \nb  \nc  \nd  ');
        model.markSaved();
        model.applyEdits([{ from: 4, to: 5, text: 'B' }]);
        model.applyEdits([{ from: 12, to: 13, text: 'D' }]);
        model.undo();
        model.setSelections([{ anchor: 0, head: 0 }]);

        expect(model.getModifiedLines()).toEqual([1, 3]);

        model.cleanUpWhitespace({ trailingWhitespace: 'modified' });

        expect(model.getText()).toBe('a  \nB\nc  \nd');
    });

    it('follows the changed lines through edits above them, and forgets them once saved', () => {
        const model = new DocumentModel('a\nb\nc');
        model.applyEdits([{ from: 4, to: 4, text: 'x' }]);
        model.applyEdits([{ from: 0, to: 0, text: 'top\n' }]);

        expect(model.getModifiedLines()).toEqual([0, 3]);

        model.markSaved();

        expect(model.getModifiedLines()).toEqual([]);
    });

    it('keeps the trailing whitespace inside a multiline string', () => {
        expect(cleaned('const a = `one  \ntwo`;  \n', { trailingWhitespace: 'all', language: 'typescript' }, 25)).toBe('const a = `one  \ntwo`;\n');
    });

    it('removes the blank lines at the end and keeps the break of the last line with text', () => {
        expect(cleaned('a\nb\n\n  \n', { removeTrailingBlankLines: true })).toBe('a\nb\n');
        expect(cleaned('a\nb  \n\n', { removeTrailingBlankLines: true, trailingWhitespace: 'all' })).toBe('a\nb\n');
    });

    it('ends the text in a line break of its own style when asked', () => {
        expect(cleaned('a\r\nb', { ensureFinalNewline: true })).toBe('a\r\nb\r\n');
        expect(cleaned('a\n', { ensureFinalNewline: true })).toBe('a\n');
        expect(cleaned('', { ensureFinalNewline: true })).toBe('');
        expect(cleaned('a  ', { ensureFinalNewline: true, trailingWhitespace: 'all' }, 0)).toBe('a  \n');
    });

    it('is one undo step', () => {
        const model = new DocumentModel('a \nb \n\n');
        model.setSelections([{ anchor: 0, head: 0 }]);

        expect(model.cleanUpWhitespace({ trailingWhitespace: 'all', keepCaretLines: false, removeTrailingBlankLines: true })).toBe(true);
        expect(model.getText()).toBe('a\nb\n');

        model.undo();

        expect(model.getText()).toBe('a \nb \n\n');
    });
});
