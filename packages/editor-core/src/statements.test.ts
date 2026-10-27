import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { EditSource } from './edit-source.ts';
import { enclosingBrace, indentGuideAt, statementAt, statementStart } from './statements.ts';

/* The model hands out its edit source to the commands only, so a test reaches it the same way. */
function sourceOf(text: string, language: string): EditSource {
    return (new DocumentModel(text) as unknown as { editSource(language: string): EditSource }).editSource(language);
}

describe('enclosingBrace', () => {
    it('finds the innermost brace, and none inside a string', () => {
        const source = sourceOf('a { b { c } }\n"{ x }"', 'typescript');

        expect(enclosingBrace(source, 10)).toBe(6);
        expect(enclosingBrace(source, 0)).toBeNull();
        expect(enclosingBrace(source, 19)).toBeNull();
    });
});

describe('indentGuideAt', () => {
    it('reads the guide that holds a line', () => {
        const source = sourceOf('a\n    b\n        c\n    d\ne', 'python');

        expect(indentGuideAt(source, 2, 4, 4)).toEqual({ startLine: 1, endLine: 3 });
        expect(indentGuideAt(source, 2, 2, 4)).toBeNull();
        expect(indentGuideAt(source, 4, 4, 4)).toBeNull();
    });
});

describe('statementStart', () => {
    const lineOf = (text: string, line: number): number => statementStart(sourceOf(text, 'typescript'), line, 'typescript');

    it('stays on a line that stands alone', () => {
        expect(lineOf('a();\nb();', 1)).toBe(1);
    });

    it('goes up to the line a statement is left open by', () => {
        expect(lineOf('const a = b &&\n    c &&\n    d;', 2)).toBe(0);
        expect(lineOf('foo()\n    .bar()\n    .baz();', 2)).toBe(0);
        expect(lineOf('if (a)\n    b();', 1)).toBe(0);
    });

    it('takes a line that opens with a closer to the statement of its opener', () => {
        expect(lineOf('a();\nif (b) {\n    c();\n} else {\n    d();\n}', 3)).toBe(1);
        expect(lineOf('a();\nfoo(\n    b\n)', 3)).toBe(1);
    });

    it('does not join a blank line', () => {
        expect(lineOf('a &&\n\nb', 2)).toBe(2);
    });
});

describe('statementAt', () => {
    const at = (text: string, line: number, structure: Parameters<typeof statementAt>[3] = []) =>
        statementAt(sourceOf(text, 'typescript'), line, 'typescript', structure);

    it('spans a statement from its first line to the one that closes its brackets', () => {
        expect(at('a();\nfoo(\n    b,\n    c\n);\nd();', 3)).toEqual({ first: 1, code: 1, last: 4 });
        expect(at('if (a) {\n    b();\n} else {\n    c();\n}\nd();', 2)).toEqual({ first: 0, code: 0, last: 4 });
        expect(at('do {\n    a();\n}\nwhile (b);\nc();', 0)).toEqual({ first: 0, code: 0, last: 3 });
    });

    it('counts the doc comment and the attributes above the code, and stands for the code from a line in them', () => {
        const text = 'a();\n\n/**\n * Doc.\n */\n@Dec()\nfoo() {\n}\nb();';

        expect(at(text, 6)).toEqual({ first: 2, code: 6, last: 7 });
        expect(at(text, 3)).toEqual({ first: 2, code: 6, last: 7 });
        expect(at(text, 5)).toEqual({ first: 2, code: 6, last: 7 });
    });

    it('leaves a line comment and a blank line as units of their own', () => {
        expect(at('a();\n// note\nb();', 1)).toEqual({ first: 1, code: 1, last: 1 });
        expect(at('a();\n\nb();', 1)).toEqual({ first: 1, code: 1, last: 1 });
    });

    it('ends where a folding range that starts on its first line ends', () => {
        expect(at('foo\nbar\nbaz', 0, [{ startLine: 0, endLine: 1, from: 0, to: 0, kind: 'server' }])).toEqual({ first: 0, code: 0, last: 1 });
    });
});
