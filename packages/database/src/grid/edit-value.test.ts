import { describe, expect, test } from 'bun:test';
import { draftOf, parseDraft } from './edit-value.ts';

describe('parseDraft', () => {
    test('an integer that is exact stays a number', () => {
        expect(parseDraft(' 42 ', 'integer')).toBe(42);
        expect(parseDraft('-7', 'integer')).toBe(-7);
    });

    test('an integer beyond the safe range goes as text, so nothing is rounded', () => {
        expect(parseDraft('9007199254740993', 'integer')).toBe('9007199254740993');
    });

    test('a decimal stays text for the server to read', () => {
        expect(parseDraft('12.50', 'decimal')).toBe('12.50');
    });

    test('a float becomes a number when it is one', () => {
        expect(parseDraft('1.5', 'float')).toBe(1.5);
        expect(parseDraft('abc', 'float')).toBe('abc');
    });

    test('an empty field is NULL where an empty string cannot be a value', () => {
        expect(parseDraft('', 'integer')).toBeNull();
        expect(parseDraft('  ', 'datetime')).toBeNull();
        expect(parseDraft('', 'text')).toBe('');
        expect(parseDraft('', 'json')).toBe('');
    });

    test('text is kept as typed', () => {
        expect(parseDraft('  spaced  ', 'text')).toBe('  spaced  ');
    });

    test('a boolean reads true, false, 1 and 0', () => {
        expect(parseDraft('TRUE', 'boolean')).toBe(true);
        expect(parseDraft('0', 'boolean')).toBe(false);
        expect(parseDraft('maybe', 'boolean')).toBe('maybe');
    });

    test('0x and an even number of hex digits is binary', () => {
        expect(parseDraft('0xABcd', 'binary')).toEqual({ kind: 'binary', hex: 'abcd' });
        expect(parseDraft('0xabc', 'binary')).toBe('0xabc');
    });
});

describe('draftOf', () => {
    test('writes a value the way parseDraft reads it back', () => {
        expect(draftOf(null)).toBe('');
        expect(draftOf(12)).toBe('12');
        expect(draftOf(true)).toBe('true');
        expect(draftOf({ kind: 'binary', hex: 'ab', length: 1 })).toBe('0xab');
        expect(draftOf({ kind: 'binary', hex: 'ab' })).toBe('0xab');
        expect(draftOf({ kind: 'default' })).toBe('');
    });
});
