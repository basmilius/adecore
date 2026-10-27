import { describe, expect, test } from 'bun:test';
import { abbreviationBefore, expandAbbreviation } from './emmet.ts';

const html = { syntax: 'html', indent: '    ' } as const;

describe('abbreviationBefore', () => {
    test('finds the abbreviation that ends at the caret', () => {
        expect(abbreviationBefore('    <p>ul>li*2', 14)).toEqual({ abbreviation: 'ul>li*2', start: 7, end: 14 });
    });

    test('reaches over the brackets the editor closed after the caret', () => {
        expect(abbreviationBefore('a[href]', 6)).toEqual({ abbreviation: 'a[href]', start: 0, end: 7 });
    });

    test('takes no number or punctuation for an abbreviation', () => {
        expect(abbreviationBefore('page 12', 7)).toBeNull();
        expect(abbreviationBefore('', 0)).toBeNull();
    });
});

describe('expandAbbreviation', () => {
    test('expands nesting with a tab stop where the text goes', () => {
        expect(expandAbbreviation('ul>li.item$*2', html)).toBe('<ul>\n    <li class="item1">${1}</li>\n    <li class="item2">${2}</li>\n</ul>');
    });

    test('reads lipsum as lorem, with a count of words', () => {
        expect(expandAbbreviation('div>p>lipsum', html)).toMatch(/^<div>\n {4}<p>Lorem\W+ipsum\W+dolor\W+sit\W+amet/);
        expect(expandAbbreviation('lipsum3', html)).toMatch(/^Lorem\W+ipsum\W+dolor\W*$/);
    });

    test('indents with the unit it is given', () => {
        expect(expandAbbreviation('div>p', { syntax: 'html', indent: '\t' })).toBe('<div>\n\t<p>${1}</p>\n</div>');
    });

    test('wraps lines, once each for a repeated element without a count', () => {
        expect(expandAbbreviation('ul>li*', { ...html, wrap: ['one', 'two'] })).toBe('<ul>\n    <li>one</li>\n    <li>two</li>\n</ul>');
        expect(expandAbbreviation('div.card', { ...html, wrap: ['<p>a</p>'] })).toBe('<div class="card">\n    <p>a</p>\n</div>');
    });

    test('escapes the wrapped text that snippet syntax would read', () => {
        expect(expandAbbreviation('b', { ...html, wrap: ['$total} \\n'] })).toBe('<b>\\$total\\} \\\\n</b>');
    });

    test('is null for what does not read as an abbreviation', () => {
        expect(expandAbbreviation('div>>p', html)).toBeNull();
        expect(expandAbbreviation('', html)).toBeNull();
    });
});
