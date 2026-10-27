import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { CommandOptions, EditorCommand, Selection } from './types.ts';

/* `|` marks a caret before and after the command. */
function carets(text: string): { text: string; selections: Selection[] } {
    const selections: Selection[] = [];
    let plain = '';

    for (const character of text) {
        if (character === '|') {
            selections.push({ anchor: plain.length, head: plain.length });
        } else {
            plain += character;
        }
    }

    return { text: plain, selections };
}

function marked(text: string, selections: readonly Selection[]): string {
    const heads = new Set(selections.map((selection) => selection.head));

    return [...text].map((character, index) => (heads.has(index) ? `|${character}` : character)).join('') + (heads.has(text.length) ? '|' : '');
}

function move(source: string, command: EditorCommand, options: CommandOptions = {}): string | false {
    const { text, selections } = carets(source);
    const model = new DocumentModel(text);
    model.setSelections(selections);
    const changed = model.execute(command, { language: 'typescript', ...options });

    return changed ? marked(model.getText(), model.getSelections()) : false;
}

const down = (source: string, options: CommandOptions = {}) => move(source, 'moveStatementDown', options);
const up = (source: string, options: CommandOptions = {}) => move(source, 'moveStatementUp', options);

describe('Move Statement', () => {
    it('swaps a statement with the one after it or before it', () => {
        expect(down('a();|\nb();\nc();')).toBe('b();\na();|\nc();');
        expect(up('a();\nb();|\nc();')).toBe('b();|\na();\nc();');
    });

    it('moves a multi-line call and a method chain as one statement', () => {
        expect(down('foo(\n    a,\n    b\n);|\nbar();')).toBe('bar();\nfoo(\n    a,\n    b\n);|');
        expect(up('bar();\nfoo(|\n    a\n);')).toBe('foo(|\n    a\n);\nbar();');
        expect(down('a()\n    .b()\n    .c();|\nd();')).toBe('d();\na()\n    .b()\n    .c();|');
    });

    it('moves an if with its else as one', () => {
        expect(down('if (a) {\n    b();\n} else {\n    c();\n}|\nd();')).toBe('d();\nif (a) {\n    b();\n} else {\n    c();\n}|');
        expect(up('d();\nif (a) {\n    b();\n} else {|\n    c();\n}')).toBe('if (a) {\n    b();\n} else {|\n    c();\n}\nd();');
    });

    it('steps over a blank line', () => {
        expect(down('a();|\n\nb();')).toBe('\na();|\nb();');
    });

    it('walks into a block after it and out of one at the bottom', () => {
        expect(down('a();|\nif (b) {\n    c();\n}')).toBe('if (b) {\n    a();|\n    c();\n}');
        expect(down('if (b) {\n    c();\n    a();|\n}\nd();')).toBe('if (b) {\n    c();\n}\na();|\nd();');
    });

    it('walks into a block before it and out of one at the top', () => {
        expect(up('if (b) {\n    c();\n}\na();|')).toBe('if (b) {\n    c();\n    a();|\n}');
        expect(up('d();\nif (b) {\n    a();|\n    c();\n}')).toBe('d();\na();|\nif (b) {\n    c();\n}');
    });

    it('steps across the line that ends one block and opens the next', () => {
        expect(down('if (a) {\n    b();|\n} else {\n    c();\n}')).toBe('if (a) {\n} else {\n    b();|\n    c();\n}');
        expect(up('if (a) {\n    b();\n} else {\n    c();|\n}')).toBe('if (a) {\n    b();\n    c();|\n} else {\n}');
    });

    it('refuses to leave a function or a literal, and to move past the end of the text', () => {
        expect(up('function f() {\n    a();|\n    b();\n}')).toBe(false);
        expect(down('function f() {\n    a();\n    b();|\n}')).toBe(false);
        expect(down('const o = {\n    a: 1,|\n};')).toBe(false);
        expect(down('a();\nb();|')).toBe(false);
        expect(up('a();|\nb();')).toBe(false);
    });

    it('takes a doc comment and an attribute along with a method, and keeps the blank line between methods', () => {
        const source = [
            'class A {',
            '    /** Doc. */',
            '    @Dec()',
            '    first() {|',
            '        a();',
            '    }',
            '',
            '    second() {',
            '        b();',
            '    }',
            '}'
        ].join('\n');

        const moved = [
            'class A {',
            '    second() {',
            '        b();',
            '    }',
            '',
            '    /** Doc. */',
            '    @Dec()',
            '    first() {|',
            '        a();',
            '    }',
            '}'
        ].join('\n');

        expect(down(source)).toBe(moved);
        expect(up('class A {\n    first() {\n        a();\n    }\n\n    second() {|\n        b();\n    }\n}')).toBe(
            'class A {\n    second() {|\n        b();\n    }\n\n    first() {\n        a();\n    }\n}'
        );
    });

    it('refuses to move a member out of its class', () => {
        expect(up('class A {\n    first() {|\n    }\n}')).toBe(false);
        expect(down('class A {\n    first() {\n    }|\n}')).toBe(false);
    });

    it('moves a top level function past the next one', () => {
        expect(down('function a() {\n}|\n\nfunction b() {\n}')).toBe('function b() {\n}\n\nfunction a() {\n}|');
    });

    it('moves the statements a selection touches, and a selection that ends at the start of a line leaves that line out', () => {
        const model = new DocumentModel('a();\nb();\nc();\nd();');
        model.setSelections([{ anchor: 2, head: 8 }]);
        model.execute('moveStatementDown', { language: 'typescript' });

        expect(model.getText()).toBe('c();\na();\nb();\nd();');
        expect(model.getSelections()).toEqual([{ anchor: 7, head: 13 }]);

        const column = new DocumentModel('a();\nb();\nc();');
        column.setSelections([{ anchor: 0, head: 5 }]);
        column.execute('moveStatementDown', { language: 'typescript' });

        expect(column.getText()).toBe('b();\na();\nc();');
    });

    it('moves each caret alone, and a caret that cannot move stays', () => {
        expect(down('a();|\nb();\nc();|\nd();')).toBe('b();\na();|\nd();\nc();|');
        expect(down('a();|\nb();\nc();\nd();|')).toBe('b();\na();|\nc();\nd();|');
    });

    it('moves a collapsed fold as one row', () => {
        const lineSpan = (line: number) => (line >= 1 && line <= 3 ? { first: 1, last: 3 } : { first: line, last: line });

        expect(down('a();|\nb();\nc();\nd();\ne();', { lineSpan })).toBe('b();\nc();\nd();\na();|\ne();');
    });

    it('takes the extent of a statement from the folding ranges it is given', () => {
        const structure = () => [{ startLine: 0, endLine: 1, from: 0, to: 0, kind: 'server' as const }];

        expect(down('foo|\nbar\nbaz', { structure })).toBe('baz\nfoo|\nbar');
    });

    it('reads the extent of a statement without a header on its line from the model, too', () => {
        expect(down('function f()\n{\n    a();\n}|\nb();')).toBe('b();\nfunction f()\n{\n    a();\n}|');
    });

    it('re-indents with tabs or spaces, as the document does', () => {
        expect(up('if (b) {\n\tc();\n}\na();|', { insertSpaces: false })).toBe('if (b) {\n\tc();\n\ta();|\n}');
        expect(up('if (b) {\n  c();\n}\na();|', { tabSize: 2 })).toBe('if (b) {\n  c();\n  a();|\n}');
    });

    it('moves a block of lines with the indentation they have, keeping what is deeper in it deeper', () => {
        expect(down('a();|\nif (b) {\n    if (c) {\n        d();\n    }\n}')).toBe('if (b) {\n    a();|\n    if (c) {\n        d();\n    }\n}');
        expect(down('x = 1;\nif (b) {\n    if (c) {\n        d();|\n    }\n}\ne();')).toBe('x = 1;\nif (b) {\n    if (c) {\n    }\n    d();|\n}\ne();');
    });

    it('moves by indentation in Python, and not into or out of a block', () => {
        const python = { language: 'python' };

        expect(down('if a:|\n    b = 1\nc = 2\nd = 3', python)).toBe('c = 2\nif a:|\n    b = 1\nd = 3');
        expect(up('c = 2\nif a:\n    b = 1\nd = 3|', python)).toBe('c = 2\nd = 3|\nif a:\n    b = 1');
        expect(up('if a:\n    b = 1|\nc = 2', python)).toBe(false);
        expect(down('if a:\n    b = 1|\nc = 2', python)).toBe(false);
    });

    it('moves a line like Move Line where the language has neither brackets nor indentation', () => {
        const text = '# a|\nb\nc';

        expect(down(text, { language: 'markdown' })).toBe(move(text, 'moveLineDown', { language: 'markdown' }));
        expect(up('a\nb|\nc', { language: 'markdown' })).toBe(move('a\nb|\nc', 'moveLineUp', { language: 'markdown' }));
    });
});
