import './test-setup.ts';
import { describe, expect, test } from 'bun:test';
import { replacedWords } from './word-diff.ts';

/* The text of `line` that each marked range covers. */
function marked(line: string, replaced: string): string[] {
    return replacedWords([line], [replaced])[0]!.map(([start, end]) => line.slice(start, end));
}

describe('the words a change replaced', () => {
    test('marks the word that differs and nothing around it', () => {
        expect(
            marked('  const salary = salaryFit(candidate.salary, vacancy.range);', '  const salary = salaryFit(candidate.expectedSalary, vacancy.range);')
        ).toEqual(['candidate.salary']);
    });

    test('marks each separate stretch of a line that changed in two places', () => {
        expect(marked('a one b two c', 'a 1 b 2 c')).toEqual(['one', 'two']);
    });

    test('draws no words where the lines added are not the lines removed, one for one', () => {
        expect(replacedWords(['one', 'two'], ['three'])).toEqual([[], []]);
        expect(replacedWords(['gone'], [])).toEqual([[]]);
    });

    test('a changed line that shares nothing marks the whole line without its leading space', () => {
        const [ranges] = replacedWords(['  old'], ['  new']);

        expect(ranges).toEqual([[2, 5]]);
    });

    test('marks nothing for a change of spacing alone', () => {
        expect(marked('    return foo;', '        return foo;')).toEqual([]);
    });

    describe('in code', () => {
        test.each([
            ['an identifier with underscores is one word', 'const user_name = get_user();', 'const user_id = get_user();', ['user_name']],
            ['a camelCase identifier is one word', 'const userName = getUser();', 'const userId = getUser();', ['userName']],
            ['punctuation around the change stays unmarked', 'foo(a, b, c)', 'foo(a, b)', [', c']],
            ['an operator is its own word', 'if (a || b) {', 'if (a && b) {', ['||']],
            ['a sigil and an arrow stay unmarked', '$this->title = $name;', '$this->name = $name;', ['title']],
            ['a quoted string marks only the word inside', 'let x = "hello there";', 'let x = "hello world";', ['there']],
            ['an apostrophe keeps a word whole', "it's the test", "it's a test", ['the']],
            ['a dotted name is one word', 'x = a.b.d;', 'x = a.b.c;', ['a.b.d']],
            ['a number with a decimal point is one word', 'x = 1.6 + 2;', 'x = 1.5 + 2;', ['1.6']],
            ['a file name with its extension is one word', 'path/to/other.ts', 'path/to/file.ts', ['other.ts']]
        ])('%s', (_name, line, replaced, expected) => {
            expect(marked(line, replaced)).toEqual(expected);
        });
    });

    test('marks nothing for a line past the size limit of the word diff', () => {
        expect(replacedWords(['a'.repeat(20001)], ['b'])).toEqual([[]]);
    });
});
