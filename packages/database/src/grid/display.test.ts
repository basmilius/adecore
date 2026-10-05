import { describe, expect, test } from 'bun:test';
import { BINARY_PREVIEW_BYTES, cellView, copyTextOf, DISPLAY_LIMIT, isPreview, shownOfEdit } from './display.ts';

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
