import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { CommandOptions } from './types.ts';

/* `|` marks the caret before and after the command. */
function complete(source: string, expected: string, options: CommandOptions = {}): void {
    const model = new DocumentModel(source.replace('|', ''));
    const caret = source.indexOf('|');
    model.setSelections([{ anchor: caret, head: caret }]);
    model.execute('completeCurrentStatement', { language: 'typescript', ...options });
    const { head } = model.getPrimary();
    const text = model.getText();

    expect(`${text.slice(0, head)}|${text.slice(head)}`).toBe(expected);
}

describe('Complete Current Statement', () => {
    it('ends a statement with a semicolon and closes its brackets', () => {
        complete('foo(bar|', 'foo(bar);|');
        complete('const a = [1, 2|', 'const a = [1, 2];|');
        complete('const a = foo(bar, {a: 1|', 'const a = foo(bar, {a: 1});|');
        complete('let a = 1|', 'let a = 1;|');
        complete('const o = {}|', 'const o = {};|');
    });

    it('starts a new line where the statement is complete', () => {
        complete('foo(bar);|', 'foo(bar);\n|');
        complete('  return a;|', '  return a;\n  |');
        complete('    }|', '    }\n    |');
    });

    it('starts a new line after an operator, and in the middle of a multi-line call or literal', () => {
        complete('const a = 1 +|', 'const a = 1 +\n    |');
        complete('foo(\n    a,\n    b|\n)', 'foo(\n    a,\n    b\n    |\n)');
        complete('const o = {\n    a: 1|\n};', 'const o = {\n    a: 1\n    |\n};');
    });

    it('opens a block after a control statement, with or without its condition', () => {
        complete('if (a|', 'if (a) {\n    |\n}');
        complete('if (a)|', 'if (a) {\n    |\n}');
        complete('    while (a && b|', '    while (a && b) {\n        |\n    }');
        complete('if|', 'if (|) {\n}');
        complete('for|', 'for (|) {\n}');
        complete('if (a) {|', 'if (a) {\n    |\n}');
    });

    it('adds a block to a keyword on its own, also after a closer', () => {
        complete('if (a) {\n    b();\n} else|', 'if (a) {\n    b();\n} else {\n    |\n}');
        complete('try|', 'try {\n    |\n}');
        complete('do|', 'do {\n    |\n} while ();');
    });

    it('completes a braceless body as a statement', () => {
        complete('if (a) foo(b|', 'if (a) foo(b);|');
        complete('do {\n} while (a|', 'do {\n} while (a);|');
    });

    it('adds a block to a declaration, and a semicolon to one that has no body', () => {
        complete('function f()|', 'function f() {\n    |\n}');
        complete('export class A extends B|', 'export class A extends B {\n    |\n}');
        complete('class A {\n    foo()|\n}', 'class A {\n    foo() {\n        |\n    }\n}');
        complete('abstract class A {\n    abstract foo()|\n}', 'abstract class A {\n    abstract foo();|\n}');
        complete('interface A {\n    foo(): void|\n}', 'interface A {\n    foo(): void;|\n}');
        complete('abstract class A|', 'abstract class A {\n    |\n}');
    });

    it('enters an open block, and splits an empty one', () => {
        complete('function f() {|', 'function f() {\n    |\n}');
        complete('function f() {}|', 'function f() {\n    |\n}');
        complete('function f() {|\n    a();\n}', 'function f() {\n    |\n    a();\n}');
    });

    it('ends a case label with a colon and moves to the line under it', () => {
        complete('switch (a) {\n    case 1|\n}', 'switch (a) {\n    case 1:\n        |\n}');
        complete('switch (a) {\n    default|\n}', 'switch (a) {\n    default:\n        |\n}');
    });

    it('closes a string', () => {
        complete('const a = "abc|', 'const a = "abc";|');
    });

    it('leaves a trailing comment where it is', () => {
        complete('foo(bar| // note', 'foo(bar);| // note');
        complete('if (a| // note', 'if (a) { // note\n    |\n}');
    });

    it('starts a new line in a comment, a template and a language without statements', () => {
        complete('// foo(|', '// foo(\n|');
        complete('/* foo|', '/* foo\n * |');
        complete('# Title|', '# Title\n|', { language: 'markdown' });
    });

    it('does not add a semicolon to a decorator, and none where a language needs none', () => {
        complete('@Component()|', '@Component()\n|');
        complete('x = foo(1|', 'x = foo(1\n|', { language: 'ruby' });
    });

    it('closes the brackets and opens the block in Python', () => {
        complete('if x|', 'if x:\n    |', { language: 'python' });
        complete('    for a in range(3|', '    for a in range(3):\n        |', { language: 'python' });
        complete('print(a|', 'print(a)|', { language: 'python' });
        complete('x = 1|', 'x = 1\n|', { language: 'python' });
    });

    it('does not close a bracket that a later line closes', () => {
        complete('foo(a,|\n    b);', 'foo(a,\n    b);\n    |');
        complete('const o = {|\n    a: 1,\n};', 'const o = {\n    a: 1,\n};\n|');
        complete('if (a &&|\n    b) {\n}', 'if (a &&\n    b) {\n    |\n}');
    });

    it('completes a statement that a later line closes at its real end', () => {
        complete('foo(a,|\n    b)', 'foo(a,\n    b);|');
        complete('const o = {|\n    a: 1,\n}', 'const o = {\n    a: 1,\n};|');
        complete('foo(a, bar(|\n    b),\n    c)\nnext();', 'foo(a, bar(\n    b),\n    c);|\nnext();');
    });

    it('closes only the brackets that nothing closes', () => {
        complete('foo(bar(a,|\n    b))', 'foo(bar(a,\n    b));|');
        complete('foo(a,|\n    b', 'foo(a,);|\n    b');
    });

    it('closes the brackets that no later line closes in Python', () => {
        complete('foo(a,|\n    b)', 'foo(a,\n    b)\n    |', { language: 'python' });
        complete('foo(a,|\n    b', 'foo(a,)|\n    b', { language: 'python' });
    });

    it('runs on every line a caret is on, and once per line', () => {
        const model = new DocumentModel('let a = 1\nlet b = 2\nlet c = 3');
        model.setSelections([
            { anchor: 9, head: 9 },
            { anchor: 3, head: 3 },
            { anchor: 12, head: 12 },
            { anchor: 26, head: 26 }
        ]);

        model.execute('completeCurrentStatement', { language: 'typescript' });

        expect(model.getText()).toBe('let a = 1;\nlet b = 2;\nlet c = 3;');
        expect(model.getSelections().map((selection) => selection.head)).toEqual([10, 21, 32]);
    });

    it('is one undo step', () => {
        const model = new DocumentModel('if (a');
        model.setSelections([{ anchor: 5, head: 5 }]);
        model.execute('completeCurrentStatement', { language: 'typescript' });
        model.execute('undo');

        expect(model.getText()).toBe('if (a');
    });
});
