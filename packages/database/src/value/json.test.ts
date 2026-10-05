import { describe, expect, test } from 'bun:test';
import { checkJson, isJsonDocument, prettyJson } from './json.ts';

describe('isJsonDocument', () => {
    test('is true for an object or an array only', () => {
        expect(isJsonDocument('{"a":1}')).toBe(true);
        expect(isJsonDocument('  [1, 2]')).toBe(true);
        expect(isJsonDocument('42')).toBe(false);
        expect(isJsonDocument('"x"')).toBe(false);
        expect(isJsonDocument('{oops')).toBe(false);
        expect(isJsonDocument('')).toBe(false);
    });
});

describe('checkJson', () => {
    test('carries the parse error', () => {
        const checked = checkJson('{"a":');
        expect(checked.ok).toBe(false);
        expect(checked.ok ? '' : checked.reason).not.toBe('');
    });
});

describe('prettyJson', () => {
    test('indents with two spaces', () => {
        expect(prettyJson('{"a":1,"b":[true,null,{"c":"x"}]}')).toBe(
            ['{', '  "a": 1,', '  "b": [', '    true,', '    null,', '    {', '      "c": "x"', '    }', '  ]', '}'].join('\n')
        );
    });

    test('keeps empty containers, strings with punctuation and big numbers as written', () => {
        expect(prettyJson('{"a":{},"b":[ ],"c":"a, {b}: \\"q\\"","d":12345678901234567890}')).toBe(
            ['{', '  "a": {},', '  "b": [],', '  "c": "a, {b}: \\"q\\"",', '  "d": 12345678901234567890', '}'].join('\n')
        );
    });

    test('is null for text that is not JSON', () => {
        expect(prettyJson('{"a":')).toBeNull();
    });
});
