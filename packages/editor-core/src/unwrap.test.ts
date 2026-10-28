import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import type { UnwrapKind, UnwrapTarget } from './unwrap.ts';

interface Result {
    readonly kinds: UnwrapKind[];
    /* The text after the edits of the target at `index`. */
    after(index?: number): string;
    readonly targets: UnwrapTarget[];
}

/* The caret is the `|` in the text. */
function unwrap(marked: string, language = 'typescript'): Result {
    const offset = marked.indexOf('|');
    const text = marked.replace('|', '');
    const targets = new DocumentModel(text).unwrapTargets(offset, language, '    ');

    return {
        kinds: targets.map((target) => target.kind),
        targets,
        after(index = 0) {
            const model = new DocumentModel(text);

            model.applyEdits([...targets[index]!.edits]);

            return model.getText();
        }
    };
}

describe('unwrapTargets', () => {
    it('keeps the body of an if and drops its else chain', () => {
        const result = unwrap('a();\nif (b) {\n    c|();\n} else if (d) {\n    e();\n} else {\n    f();\n}\ng();');

        expect(result.kinds).toEqual(['if']);
        expect(result.after()).toBe('a();\nc();\ng();');
        expect(result.targets[0]!.range).toEqual({ from: 5, to: 67 });
    });

    it('offers the else two ways', () => {
        const result = unwrap('if (a) {\n    b();\n} else {\n    c|();\n}');

        expect(result.kinds).toEqual(['else', 'removeElse']);
        expect(result.after(0)).toBe('c();');
        expect(result.after(1)).toBe('if (a) {\n    b();\n}');
    });

    it('unwraps the nested if of an else if', () => {
        const result = unwrap('if (a) {\n    b();\n} else if (c) {\n    d|();\n}');

        expect(result.kinds).toEqual(['if']);
        expect(result.after()).toBe('if (a) {\n    b();\n} else d();');
    });

    it('takes the else of an else if chain as the end of the whole statement', () => {
        const result = unwrap('if (a) {\n    b();\n} else if (c) {\n    d();\n} else {\n    e|();\n}');

        expect(result.kinds).toEqual(['else', 'removeElse']);
        expect(result.after(0)).toBe('e();');
        expect(result.after(1)).toBe('if (a) {\n    b();\n} else if (c) {\n    d();\n}');
    });

    it('unwraps loops and bare blocks, innermost first', () => {
        const result = unwrap('for (const a of b) {\n    while (c) {\n        d|();\n    }\n}\n{\n    e();\n}');

        expect(result.kinds).toEqual(['while', 'for']);
        expect(result.after(0)).toBe('for (const a of b) {\n    d();\n}\n{\n    e();\n}');
        expect(unwrap('for await (const a of b) {\n    c|();\n}').kinds).toEqual(['for']);
        expect(unwrap('x();\n{\n    a|();\n}').after()).toBe('x();\na();');
        expect(unwrap('foreach ($a as $b) {\n    c|();\n}', 'php').kinds).toEqual(['for']);
    });

    it('takes the while condition of a do along', () => {
        const result = unwrap('do {\n    a|();\n} while (b);\nc();');

        expect(result.kinds).toEqual(['do']);
        expect(result.after()).toBe('a();\nc();');
    });

    it('drops the clauses of a try', () => {
        const result = unwrap('try {\n    a|();\n} catch (e) {\n    b();\n} finally {\n    c();\n}');

        expect(result.kinds).toEqual(['try']);
        expect(result.after()).toBe('a();');
    });

    it('removes a catch only where a finally or another catch stays', () => {
        const full = unwrap('try {\n    a();\n} catch (e) {\n    b|();\n} finally {\n    c();\n}');

        expect(full.kinds).toEqual(['removeCatch']);
        expect(full.after()).toBe('try {\n    a();\n} finally {\n    c();\n}');
        expect(unwrap('try {\n    a();\n} catch (e) {\n    b|();\n}').kinds).toEqual([]);
        expect(unwrap('try {\n    a();\n} catch (e) {\n    b();\n} catch (f) {\n    c|();\n}').kinds).toEqual(['removeCatch']);
    });

    it('removes a finally only beside a catch', () => {
        const full = unwrap('try {\n    a();\n} catch (e) {\n    b();\n} finally {\n    c|();\n}');

        expect(full.kinds).toEqual(['removeFinally']);
        expect(full.after()).toBe('try {\n    a();\n} catch (e) {\n    b();\n}');
        expect(unwrap('try {\n    a();\n} finally {\n    c|();\n}').kinds).toEqual([]);
    });

    it('moves the body to the indentation of the header', () => {
        const result = unwrap('function f() {\n    if (a) {\n        b();\n        if (c) {\n            d|();\n        }\n    }\n}');

        expect(result.kinds).toEqual(['if', 'if']);
        expect(result.after(1)).toBe('function f() {\n    b();\n    if (c) {\n        d();\n    }\n}');
        expect(unwrap('if (a) { b|(); }').after()).toBe('b();');
        expect(unwrap('if (a)\n{\n    b|();\n}').after()).toBe('b();');
    });

    it('deletes the construct and its line when the body is empty', () => {
        expect(unwrap('a();\nif (b) {\n    |\n}\nc();').after()).toBe('a();\nc();');
    });

    it('gives nothing for functions, classes, objects and switches', () => {
        expect(unwrap('function f() {\n    a|();\n}').kinds).toEqual([]);
        expect(unwrap('class A {\n    b|() {}\n}').kinds).toEqual([]);
        expect(unwrap('const a = {\n    b: 1|\n};').kinds).toEqual([]);
        expect(unwrap('switch (a) {\n    case 1: b|();\n}').kinds).toEqual([]);
        expect(unwrap('const f = () => {\n    a|();\n};').kinds).toEqual([]);
    });

    it('does not take a brace in a string or a comment for a block', () => {
        expect(unwrap("if (a) {\n    b('{', |c);\n}").kinds).toEqual(['if']);
        expect(unwrap('if (a) {\n    b(); // }\n    |c();\n}').after()).toBe('b(); // }\nc();');
        expect(unwrap("const a = '{ |';").kinds).toEqual([]);
        expect(unwrap('// if (a) { |').kinds).toEqual([]);
    });

    it('reads every kind of PHP block', () => {
        const kinds = (text: string) => unwrap(text, 'php').kinds;

        expect(kinds('<?php\nif ($a) {\n    $b;\n} else {\n    $c|;\n}')).toEqual(['else', 'removeElse']);
        expect(kinds('<?php\ntry {\n    $a;\n} catch (Exception $e) {\n    $b|;\n} finally {\n    $c;\n}')).toEqual(['removeCatch']);
        expect(kinds('<?php\ntry {\n    $a;\n} catch (Exception $e) {\n    $b;\n} finally {\n    $c|;\n}')).toEqual(['removeFinally']);
        expect(kinds('<?php\nwhile ($a) {\n    $b|;\n}')).toEqual(['while']);
        expect(kinds('<?php\ndo {\n    $b|;\n} while ($a);')).toEqual(['do']);
        expect(kinds('<?php\nclass A {\n    function b() {\n        $c|;\n    }\n}')).toEqual([]);
    });

    it('reads PHP and the script of a Vue file', () => {
        expect(unwrap('<?php\nif ($a) {\n    echo 1|;\n} elseif ($b) {\n    echo 2;\n}', 'php').after()).toBe('<?php\necho 1;');
        expect(unwrap('<template>\n  <p/>\n</template>\n<script lang="ts">\nif (a) {\n    b|();\n}\n</script>', 'vue').kinds).toEqual(['if']);
        expect(unwrap('<template>\n  <p>|</p>\n</template>', 'vue').kinds).toEqual([]);
    });
});
