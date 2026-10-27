import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { CommandOptions, EditorCommand } from './types.ts';

/* `|` marks the caret, before and after the command. */
function run(source: string, command: EditorCommand, options: CommandOptions = {}): string {
    const model = new DocumentModel(source.replace('|', ''));
    const caret = source.indexOf('|');
    model.setSelections([{ anchor: caret, head: caret }]);
    model.execute(command, { language: 'typescript', ...options });
    const { head } = model.getPrimary();
    const result = model.getText();

    return `${result.slice(0, head)}|${result.slice(head)}`;
}

describe('Code Block End', () => {
    it('goes before the closer of the block around the caret, then outward', () => {
        const source = 'function a() {\n    if (b) {\n        c|();\n    }\n}\n';
        const first = run(source, 'codeBlockEnd');

        expect(first).toBe('function a() {\n    if (b) {\n        c();\n    |}\n}\n');
        expect(run(first, 'codeBlockEnd')).toBe('function a() {\n    if (b) {\n        c();\n    }\n|}\n');
    });

    it('goes after the closer when the caret is in front of an opener', () => {
        expect(run('if (a) |{\n    b();\n}\nc();', 'codeBlockEnd')).toBe('if (a) {\n    b();\n}|\nc();');
    });

    it('leaves a caret outside any block where it is', () => {
        expect(run('a|();', 'codeBlockEnd')).toBe('a|();');
    });

    it('ignores braces in strings and comments', () => {
        expect(run('{\n    const a = "}"; // }\n    b|();\n}', 'codeBlockEnd')).toBe('{\n    const a = "}"; // }\n    b();\n|}');
        expect(run('{\n    "{ a| }";\n}', 'codeBlockEnd')).toBe('{\n    "{ a| }";\n}');
    });
});

describe('Code Block Start', () => {
    it('goes after the opener of the block around the caret, then outward', () => {
        const source = 'function a() {\n    if (b) {\n        c|();\n    }\n}\n';
        const first = run(source, 'codeBlockStart');

        expect(first).toBe('function a() {\n    if (b) {|\n        c();\n    }\n}\n');
        expect(run(first, 'codeBlockStart')).toBe('function a() {|\n    if (b) {\n        c();\n    }\n}\n');
    });

    it('goes before the opener when the caret is behind a closer', () => {
        expect(run('c();\nif (a) {\n    b();\n}|\n', 'codeBlockStart')).toBe('c();\nif (a) |{\n    b();\n}\n');
    });
});

describe('Code Block with selection', () => {
    it('keeps the anchor and moves the head to the end', () => {
        const model = new DocumentModel('{\n    a();\n}');
        model.setSelections([{ anchor: 6, head: 6 }]);
        model.execute('codeBlockEndWithSelection', { language: 'typescript' });

        expect(model.getSelections()).toEqual([{ anchor: 6, head: 11 }]);
    });

    it('keeps the anchor and moves the head to the start', () => {
        const model = new DocumentModel('{\n    a(b);\n}');
        model.setSelections([{ anchor: 8, head: 8 }]);
        model.execute('codeBlockStartWithSelection', { language: 'typescript' });

        expect(model.getSelections()).toEqual([{ anchor: 8, head: 1 }]);
    });
});

describe('Code Block on indent guides', () => {
    const source = 'def a():\n    if b:\n        c()\n        d()\n    e()\nf()\n';

    it('goes to the end of the guide at the caret column when guides count', () => {
        const model = new DocumentModel(source);
        // Column 4 of the line `        c()`, on the guide of `    if b:`.
        model.setSelections([{ anchor: 19 + 4, head: 19 + 4 }]);
        model.execute('codeBlockEnd', { language: 'python', indentGuides: true });

        expect(model.positionAt(model.getPrimary().head)).toEqual({ line: 4, column: 4 });
    });

    it('goes to the start of the guide, and not when the caret is on the header', () => {
        const model = new DocumentModel(source);
        model.setSelections([{ anchor: 19 + 4, head: 19 + 4 }]);
        model.execute('codeBlockStart', { language: 'python', indentGuides: true });

        expect(model.positionAt(model.getPrimary().head)).toEqual({ line: 1, column: 4 });
    });

    it('does nothing with the guides off and no braces', () => {
        const model = new DocumentModel(source);
        model.setSelections([{ anchor: 21, head: 21 }]);

        expect(model.execute('codeBlockEnd', { language: 'python' })).toBe(false);
    });

    it('does nothing inside the text of a line', () => {
        const model = new DocumentModel(source);
        model.setSelections([{ anchor: 28, head: 28 }]);

        expect(model.execute('codeBlockEnd', { language: 'python', indentGuides: true })).toBe(false);
    });
});

describe('Code Block with several carets', () => {
    it('moves each caret to the end of its own block', () => {
        const model = new DocumentModel('{ a }\n{ b }');
        model.setSelections([
            { anchor: 2, head: 2 },
            { anchor: 8, head: 8 }
        ]);
        model.execute('codeBlockEnd', { language: 'typescript' });

        expect(model.getSelections()).toEqual([
            { anchor: 4, head: 4 },
            { anchor: 10, head: 10 }
        ]);
    });
});
