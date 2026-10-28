import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';

/* The operands before the `.|`, as their texts with a `!` on the one that starts a statement. */
function operands(marked: string, language = 'typescript'): string[] {
    const dot = marked.indexOf('.|');
    const text = marked.replace('.|', '.');
    const model = new DocumentModel(text);

    return model.postfixOperands(dot, language).map((operand) => `${text.slice(operand.from, dot).trimEnd()}${operand.statement ? '!' : ''}`);
}

describe('postfixOperands', () => {
    it('takes a name, a member chain and a call chain whole', () => {
        expect(operands('x.|')).toEqual(['x!']);
        expect(operands('a.b(c).d.|')).toEqual(['a.b(c).d!']);
        expect(operands('a[0]?.b!.c.|')).toEqual(['a[0]?.b!.c!']);
        expect(operands('new Foo(1).bar.|')).toEqual(['new Foo(1).bar!']);
        expect(operands('(a + b).c.|')).toEqual(['(a + b).c!']);
    });

    it('reaches over lines, comments and whitespace', () => {
        expect(operands('foo()\n    .bar.|')).toEqual(['foo()\n    .bar!']);
        expect(operands('foo() /* x */\n    // y\n    .bar.|')).toEqual(['foo() /* x */\n    // y\n    .bar!']);
        expect(operands('foo() .|')).toEqual(['foo()!']);
    });

    it('offers each expression the dot can end', () => {
        expect(operands('!a.|')).toEqual(['a', '!a!']);
        expect(operands('a * b + c.|')).toEqual(['c', 'a * b + c!']);
        expect(operands('a + b * c.|')).toEqual(['c', 'b * c', 'a + b * c!']);
        expect(operands('a + b + c.|')).toEqual(['c', 'a + b + c!']);
        expect(operands('typeof a === "b" && await c.|')).toEqual(['c', 'await c', 'typeof a === "b" && await c!']);
        expect(operands('a ? b : c.|')).toEqual(['c', 'a ? b : c!']);
        expect(operands('a ? b : c ? d : e.|')).toEqual(['e', 'c ? d : e', 'a ? b : c ? d : e!']);
        expect(operands('a ?? b ?? c.|')).toEqual(['c', 'b ?? c', 'a ?? b ?? c!']);
    });

    it('stops at what is not part of the expression', () => {
        expect(operands('x = a.|')).toEqual(['a']);
        expect(operands('return a.|')).toEqual(['a']);
        expect(operands('foo(a, b.|')).toEqual(['b']);
        expect(operands('const f = (a) => a.|')).toEqual(['a']);
        expect(operands('if (a) {\n    b();\n}\nc.|')).toEqual(['c!']);
        expect(operands('a +\n    b.|')).toEqual(['b', 'a +\n    b!']);
        expect(operands('a\n    + b.|')).toEqual(['b']);
    });

    it('marks the widest operand as a statement only after a statement boundary', () => {
        expect(operands('a();\nb.|')).toEqual(['b!']);
        expect(operands('if (a) b.|')).toEqual(['b!']);
        expect(operands('else b.|')).toEqual(['b!']);
        expect(operands('foo(\n    b.|')).toEqual(['b']);
        expect(operands('a = [\n    b.|')).toEqual(['b']);
    });

    it('keeps a decimal point out of it', () => {
        expect(operands('1.|')).toEqual([]);
        expect(operands('1.5.|')).toEqual(['1.5!']);
        expect(operands('x1.|')).toEqual(['x1!']);
    });

    it('takes literals whole', () => {
        expect(operands('"a.b".|')).toEqual(['"a.b"!']);
        expect(operands('`a${b}c`.|')).toEqual(['`a${b}c`!']);
        expect(operands('/a+/g.|')).toEqual(['/a+/g!']);
        expect(operands("x = 'a' + 'b'.|")).toEqual(["'b'", "'a' + 'b'"]);
    });

    it('gives nothing in a string, a comment or markup', () => {
        expect(operands('"abc.|"')).toEqual([]);
        expect(operands('// abc.|')).toEqual([]);
        expect(operands('<div>a.|</div>', 'html')).toEqual([]);
        expect(operands('.|')).toEqual([]);
        expect(operands('if (a) {\n}.|')).toEqual([]);
    });

    it('reads PHP members, concatenation and casts', () => {
        expect(operands('<?php\n$a->b?->c.|', 'php')).toEqual(['$a->b?->c!']);
        expect(operands('<?php\nFoo::bar().|', 'php')).toEqual(['Foo::bar()!']);
        expect(operands('<?php\n\\App\\Foo::bar().|', 'php')).toEqual(['\\App\\Foo::bar()!']);
        expect(operands("<?php\n's'.$v.|", 'php')).toEqual(['$v', "'s'.$v!"]);
        expect(operands('<?php\n(int) $a.|', 'php')).toEqual(['$a', '(int) $a!']);
        expect(operands('<?php\n@$a.|', 'php')).toEqual(['$a', '@$a!']);
        expect(operands('<?php\n$x = $a.|', 'php')).toEqual(['$a']);
    });

    it('works in the script of a Vue file and not in its template', () => {
        expect(operands('<script lang="ts">\nconst a = 1;\nb.|\n</script>', 'vue')).toEqual(['b!']);
        expect(operands('<template>\n  <div>{{ b.| }}</div>\n</template>', 'vue')).toEqual([]);
    });
});
