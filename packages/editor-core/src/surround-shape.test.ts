import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';

/* The range between the two `|` marks, or the whole text without them. */
function shape(marked: string, language = 'typescript') {
    const from = marked.indexOf('|');
    const to = marked.lastIndexOf('|') - 1;
    const text = marked.replaceAll('|', '');

    return new DocumentModel(text).surroundShape(from, to, language);
}

describe('surroundShape', () => {
    it('gives nothing for a blank range', () => {
        expect(shape('a();\n|  |\nb();')).toBeNull();
    });

    it('trims the range', () => {
        expect(shape('a();\n|  b();  |\nc();')).toMatchObject({ from: 7, to: 11 });
    });

    it('takes whole statements', () => {
        expect(shape('|a();\nb();|')).toMatchObject({ statements: true, expression: false });
        expect(shape('x;\n|if (a) {\n    b();\n}|\nc();')).toMatchObject({ statements: true });
        expect(shape('if (a) {\n    |b();\n    c();|\n}')).toMatchObject({ statements: true });
        expect(shape('if (a)\n    |b();|')).toMatchObject({ statements: true });
        expect(shape('a(); |b();|')).toMatchObject({ statements: true });
    });

    it('widens past a trailing line comment', () => {
        const range = shape('|a(); |// note\nb();');

        expect(range).toMatchObject({ statements: true, from: 0, to: 12 });
    });

    it('refuses half a statement', () => {
        expect(shape('|if (a) {\n    b();|\n}')?.statements).toBe(false);
        expect(shape('foo(|a, b|);')?.statements).toBe(false);
        expect(shape('foo(\n    |a,\n    b|\n);')?.statements).toBe(false);
        expect(shape('const a = |b &&\n    c|;')?.statements).toBe(false);
        expect(shape('|const a =|\n    b;')?.statements).toBe(false);
    });

    it('refuses a range that starts or ends outside code', () => {
        expect(shape("const a = 'x|y';\nb|();")).toMatchObject({ statements: false, expression: false });
        expect(shape('// no|te\n|a();')).toMatchObject({ statements: false, expression: false });
    });

    it('takes one expression', () => {
        expect(shape('const a = |b + c|;')).toMatchObject({ statements: false, expression: true });
        expect(shape('|foo()|')).toMatchObject({ statements: true, expression: true });
        expect(shape('foo(|a, b|);')?.expression).toBe(true);
    });

    it('refuses an expression over lines, with a statement, a block or a keyword, and takes an object literal', () => {
        expect(shape('foo(|a,\n    b|);')?.expression).toBe(false);
        expect(shape('foo(|a; b|);')?.expression).toBe(false);
        expect(shape('const a = |{ b: 1 }|;')?.expression).toBe(true);
        expect(shape('|if (a) { b(); }|')?.expression).toBe(false);
        expect(shape('|return a|;')?.expression).toBe(false);
    });

    it('takes whole statements in PHP', () => {
        expect(shape('<?php\n|$a = 1;\n$b = 2;|', 'php')).toMatchObject({ statements: true });
    });
});
