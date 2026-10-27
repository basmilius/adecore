import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { EditSource } from './edit-source.ts';
import { enclosingBrace, indentGuideAt, statementStart } from './statements.ts';

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
