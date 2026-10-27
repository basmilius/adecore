import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import { detectIndentation } from './line-order.ts';
import type { CommandOptions, EditorCommand, Selection } from './types.ts';

function run(command: EditorCommand, text: string, selections: Selection[] = [{ anchor: 0, head: 0 }], options: CommandOptions = {}): DocumentModel {
    const model = new DocumentModel(text);
    model.setSelections(selections);
    model.execute(command, { language: 'typescript', ...options });

    return model;
}

describe('sort, reverse and unique lines', () => {
    it('acts on the whole text with nothing selected, and leaves the line break at its end alone', () => {
        expect(run('sortLines', 'c\nb\na\n').getText()).toBe('a\nb\nc\n');
        expect(run('reverseLines', 'a\nb\nc').getText()).toBe('c\nb\na');
        expect(run('uniqueLines', 'a\nb\na\nb\nc').getText()).toBe('a\nb\nc');
    });

    it('acts on every line a selection touches, but not on the line it ends at the start of', () => {
        const model = run('sortLines', 'z\nc\nb\na\ny', [{ anchor: 3, head: 6 }]);

        expect(model.getText()).toBe('z\nb\nc\na\ny');
        expect(model.getSelections()).toEqual([{ anchor: 3, head: 6 }]);
        expect(run('sortLines', 'z\nc\nb\na\ny', [{ anchor: 2, head: 6 }]).getText()).toBe('z\nb\nc\na\ny');
    });

    it('takes each selection on its own', () => {
        expect(
            run('reverseLines', 'a\nb\nx\nc\nd', [
                { anchor: 0, head: 3 },
                { anchor: 6, head: 9 }
            ]).getText()
        ).toBe('b\na\nx\nd\nc');
    });

    it('sorts by code unit, capitals first, and keeps equal lines in their order', () => {
        expect(run('sortLines', 'b\nB\na\nA\n10\n9').getText()).toBe('10\n9\nA\nB\na\nb');
    });

    it('keeps each line break where it was', () => {
        expect(run('reverseLines', 'a\r\nb\nc').getText()).toBe('c\r\nb\na');
    });

    it('keeps a selection inside the shorter text after unique', () => {
        const model = run('uniqueLines', 'a\na\na\nb', [{ anchor: 0, head: 7 }]);

        expect(model.getText()).toBe('a\nb');
        expect(model.getSelections()).toEqual([{ anchor: 0, head: 3 }]);
    });

    it('is one undo step, and changes nothing on lines already in order', () => {
        const model = run('sortLines', 'b\na\nc');
        model.undo();

        expect(model.getText()).toBe('b\na\nc');
        expect(new DocumentModel('a\nb').execute('sortLines')).toBe(false);
    });
});

describe('convert indents', () => {
    it('turns tabs into spaces to their stops, and spaces into as many tabs as fit', () => {
        expect(run('convertIndentsToSpaces', '\tone\n  \ttwo\nthree\t', undefined, { tabSize: 4 }).getText()).toBe('    one\n    two\nthree\t');
        expect(run('convertIndentsToTabs', '        one\n      two\n  three', undefined, { tabSize: 4 }).getText()).toBe('\t\tone\n\t  two\n  three');
    });

    it('acts on the selected lines only', () => {
        expect(run('convertIndentsToTabs', '    a\n    b\n    c', [{ anchor: 6, head: 7 }], { tabSize: 4 }).getText()).toBe('    a\n\tb\n    c');
    });
});

describe('detectIndentation', () => {
    it('reads the width of one level of spaces from the steps between lines', () => {
        expect(detectIndentation('a {\n  b {\n    c;\n  }\n}')).toEqual({ insertSpaces: true, tabSize: 2 });
        expect(detectIndentation('a {\n    b(x,\n       y);\n    c;\n}')).toEqual({ insertSpaces: true, tabSize: 4 });
    });

    it('chooses tabs when more lines start with one', () => {
        expect(detectIndentation('a {\n\tb;\n\tc;\n  d;\n}')).toEqual({ insertSpaces: false });
    });

    it('leaves out the star lines of a block comment and says nothing without indentation', () => {
        expect(detectIndentation('/**\n * doc\n */\nfunction a() {\n    b();\n}')).toEqual({ insertSpaces: true, tabSize: 4 });
        expect(detectIndentation('a\nb\n')).toBeNull();
    });
});
