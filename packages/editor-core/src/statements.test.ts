import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { EditSource } from './edit-source.ts';
import { enclosingBrace, indentGuideAt } from './statements.ts';

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
