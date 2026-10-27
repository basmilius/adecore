import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';

const SOURCE = ['class A {', '    first() {', '        return 1;', '    }', '', '    second() {', '        return 2;', '    }', '}'].join('\n');

describe('Method Up and Down', () => {
    test('stop at the declarations a host handed over, and not past the last or the first', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        editor.setDeclarations?.([
            { line: 5, character: 4 },
            { line: 1, character: 4 },
            { line: 0, character: 6 }
        ]);

        editor.setCaret({ line: 2, character: 3 });

        expect(editor.runCommand('methodDown')).toBe(true);
        expect(editor.getCaret()).toEqual({ line: 5, character: 4 });
        expect(editor.runCommand('methodDown')).toBe(false);
        expect(editor.getCaret()).toEqual({ line: 5, character: 4 });
        expect(editor.runCommand('methodUp')).toBe(true);
        expect(editor.getCaret()).toEqual({ line: 1, character: 4 });
        expect(editor.runCommand('methodUp')).toBe(true);
        expect(editor.getCaret()).toEqual({ line: 0, character: 6 });
        expect(editor.runCommand('methodUp')).toBe(false);
    });

    test('follow their text through an edit above them', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        editor.setDeclarations?.([{ line: 5, character: 4 }]);
        editor.applyEdits([{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: '// a\n' }]);
        editor.setCaret({ line: 0, character: 0 });
        editor.runCommand('methodDown');

        expect(editor.getCaret()).toEqual({ line: 6, character: 4 });
    });

    test('read the names of the structure where no host has declarations', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        editor.setCaret({ line: 0, character: 0 });
        editor.runCommand('methodDown');
        const first = editor.getCaret();
        editor.runCommand('methodDown');

        expect(first).toEqual({ line: 1, character: 4 });
        expect(editor.getCaret()).toEqual({ line: 5, character: 4 });
    });

    test('collapse the carets and the selection to the one that moved, and tell the listeners where it left', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        const left: unknown[] = [];
        editor.onNavigate?.((from) => left.push(from));
        editor.setDeclarations?.([{ line: 5, character: 4 }]);

        editor.setSelections([
            { start: { line: 1, character: 4 }, end: { line: 1, character: 9 } },
            { start: { line: 2, character: 0 }, end: { line: 2, character: 2 } }
        ]);

        editor.runCommand('methodDown');

        expect(editor.getSelections()).toEqual([{ start: { line: 5, character: 4 }, end: { line: 5, character: 4 } }]);
        expect(left).toEqual([{ line: 2, character: 2 }]);
    });

    test('open a fold that hides the target', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        editor.setDeclarations?.([{ line: 2, character: 8 }]);
        editor.setCaret({ line: 0, character: 0 });
        editor.runCommand('collapseRegionRecursively');
        editor.runCommand('methodDown');

        expect(editor.getCaret()).toEqual({ line: 2, character: 8 });
        expect(editor.getFolds().collapsed.some((fold) => fold.startLine === 0)).toBe(false);
    });
});

describe('Next Change and Previous Change', () => {
    test('run as view commands that move to the marked lines', () => {
        const { editor } = mountEditor({ text: SOURCE });
        editor.setChangeMarks([{ kind: 'modified', startLine: 6, endLine: 7 }]);
        editor.setCaret({ line: 0, character: 0 });

        expect(editor.runCommand('nextChange')).toBe(true);
        expect(editor.getCaret()).toEqual({ line: 5, character: 0 });
        expect(editor.runCommand('nextChange')).toBe(false);
        editor.setCaret({ line: 8, character: 0 });
        expect(editor.runCommand('previousChange')).toBe(true);
        expect(editor.getCaret()).toEqual({ line: 5, character: 0 });
    });
});

describe('Code Block Start and End', () => {
    test('go outward on every press and tell the listeners where the caret left', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        const left: unknown[] = [];
        editor.onNavigate?.((from) => left.push(from));
        editor.setCaret({ line: 2, character: 10 });

        editor.runCommand('codeBlockEnd');
        expect(editor.getCaret()).toEqual({ line: 3, character: 4 });
        editor.runCommand('codeBlockEnd');
        expect(editor.getCaret()).toEqual({ line: 8, character: 0 });
        expect(left).toEqual([
            { line: 2, character: 10 },
            { line: 3, character: 4 }
        ]);
    });

    test('select from the anchor to the start of the block', () => {
        const { editor } = mountEditor({ text: SOURCE, language: 'typescript' });
        editor.setCaret({ line: 2, character: 10 });
        editor.runCommand('codeBlockStartWithSelection');

        expect(editor.getSelections()).toEqual([{ start: { line: 1, character: 13 }, end: { line: 2, character: 10 } }]);
    });

    test('count the guides as blocks only while the guides are on', () => {
        const text = 'a\n    b\n        c\n    d';
        const on = mountEditor({ text, language: 'python', guides: true });
        on.editor.setCaret({ line: 2, character: 4 });

        expect(on.editor.runCommand('codeBlockEnd')).toBe(true);
        expect(on.editor.getCaret()).toEqual({ line: 3, character: 4 });

        const off = mountEditor({ text, language: 'python', guides: false });
        off.editor.setCaret({ line: 2, character: 4 });

        expect(off.editor.runCommand('codeBlockEnd')).toBe(false);
    });
});
