import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { setFormatSource, type FormatSource } from '@adecore/ui/format';
import { fakeFormatSource } from '@adecore/ui/testing';
import { BINARY_PREVIEW_BYTES, cellView, copyTextOf, DISPLAY_LIMIT, isPreview, numeralText, shownOfEdit } from './display.ts';

const source = fakeFormatSource();
let previous: FormatSource;

beforeAll(() => {
    source.set({ region: 'nl-NL' });
    previous = setFormatSource(source);
});

afterAll(() => {
    setFormatSource(previous);
});

describe('number notation', () => {
    test('the database notation draws numbers as the server wrote them', () => {
        expect(cellView('9007199254740993', 'integer').text).toBe('9007199254740993');
        expect(cellView('12900.50', 'decimal').text).toBe('12900.50');
        expect(cellView(1234.5, 'float').text).toBe('1234.5');
    });

    test('the region notation groups and separates a big integer without rounding it', () => {
        expect(cellView('9007199254740993', 'integer', 'region').text).toBe('9.007.199.254.740.993');
        expect(cellView(1234567, 'integer', 'region').text).toBe('1.234.567');
    });

    test('the region notation keeps the trailing zeros of a decimal', () => {
        expect(cellView('12900.50', 'decimal', 'region').text).toBe('12.900,50');
        expect(cellView('-0.500', 'decimal', 'region').text).toBe('-0,500');
    });

    test('the region notation writes a float with the digits it has', () => {
        expect(cellView(1234.5, 'float', 'region').text).toBe('1.234,5');
        expect(cellView(-2.25, 'float', 'region')).toEqual({ text: '-2,25', tone: 'value', align: 'end' });
    });

    test('text that is no numeral, a NULL and text columns stay as they are', () => {
        expect(cellView('NaN', 'float', 'region').text).toBe('NaN');
        expect(cellView('1e999', 'float', 'region').text).toBe('1e999');
        expect(cellView(Number.POSITIVE_INFINITY, 'float', 'region').text).toBe('Infinity');
        expect(cellView('1234', 'text', 'region').text).toBe('1234');
        expect(cellView(null, 'integer', 'region').text).toBe('NULL');
    });

    test('copying keeps the server text in either notation', () => {
        expect(copyTextOf('12900.50')).toBe('12900.50');
        expect(copyTextOf(1234.5)).toBe('1234.5');
    });

    test('a numeral in either notation', () => {
        expect(numeralText('1234.50', 'database')).toBe('1234.50');
        expect(numeralText('1234.50', 'region')).toBe('1.234,50');
        expect(numeralText(' abc ', 'region')).toBe(' abc ');
    });
});

describe('cellView', () => {
    test('null is the faint word NULL', () => {
        expect(cellView(null, 'text')).toEqual({ text: 'NULL', tone: 'null', align: 'start' });
    });

    test('a number aligns to the end, and so does the NULL of its column', () => {
        expect(cellView(42, 'integer')).toEqual({ text: '42', tone: 'value', align: 'end' });
        expect(cellView('12.50', 'decimal').align).toBe('end');
        expect(cellView(null, 'integer').align).toBe('end');
        expect(cellView('abc', 'text').align).toBe('start');
    });

    test('a boolean is spelled out', () => {
        expect(cellView(true, 'boolean').text).toBe('true');
        expect(cellView(false, 'boolean').text).toBe('false');
    });

    test('a text beyond the display limit is cut with an ellipsis', () => {
        const view = cellView('a'.repeat(DISPLAY_LIMIT + 50), 'text');
        expect(view.text).toBe(`${'a'.repeat(DISPLAY_LIMIT)}…`);
    });

    test('a long text preview always ends in an ellipsis', () => {
        expect(cellView({ kind: 'longText', preview: 'Once upon', length: 90_000 }, 'text').text).toBe('Once upon…');
    });

    test('a binary value shows its first bytes and its size', () => {
        const hex = 'ab'.repeat(BINARY_PREVIEW_BYTES + 4);
        const view = cellView({ kind: 'binary', hex, length: 2048 }, 'binary');
        expect(view.text).toBe(`0x${'ab'.repeat(BINARY_PREVIEW_BYTES)}…`);
        expect(view.suffix).toBe('2 KB');
    });

    test('a short binary value is spelled out whole, without an ellipsis', () => {
        const view = cellView({ kind: 'binary', hex: '0a0b', length: 2 }, 'binary');
        expect(view.text).toBe('0x0a0b');
        expect(view.suffix).toBe('2 B');
    });

    test('a default is a faint DEFAULT', () => {
        expect(cellView({ kind: 'default' }, 'text')).toMatchObject({ text: 'DEFAULT', tone: 'default' });
    });
});

describe('isPreview', () => {
    test('long text and a cut binary value are previews, anything else is whole', () => {
        expect(isPreview({ kind: 'longText', preview: 'a', length: 10 })).toBe(true);
        expect(isPreview({ kind: 'binary', hex: 'aa', length: 4 })).toBe(true);
        expect(isPreview({ kind: 'binary', hex: 'aabb', length: 2 })).toBe(false);
        expect(isPreview('text')).toBe(false);
        expect(isPreview(null)).toBe(false);
        expect(isPreview({ kind: 'default' })).toBe(false);
    });
});

describe('copyTextOf', () => {
    test('copies the value as the cell has it', () => {
        expect(copyTextOf('a')).toBe('a');
        expect(copyTextOf(5)).toBe('5');
        expect(copyTextOf(null)).toBe('NULL');
        expect(copyTextOf({ kind: 'binary', hex: 'ff', length: 1 })).toBe('0xff');
        expect(copyTextOf({ kind: 'longText', preview: 'abc', length: 9 })).toBe('abc');
    });
});

describe('shownOfEdit', () => {
    test('a binary edit becomes a whole binary cell', () => {
        expect(shownOfEdit({ kind: 'binary', hex: 'abcd' })).toEqual({ kind: 'binary', hex: 'abcd', length: 2 });
    });

    test('other edits pass through', () => {
        expect(shownOfEdit('x')).toBe('x');
        expect(shownOfEdit({ kind: 'default' })).toEqual({ kind: 'default' });
    });
});
