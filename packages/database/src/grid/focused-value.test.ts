import { describe, expect, test } from 'bun:test';
import { previewValueOf, wholeValueOf } from './focused-value.ts';

describe('wholeValueOf', () => {
    test('is the value of a whole cell', () => {
        expect(wholeValueOf(7)).toBe(7);
        expect(wholeValueOf(null)).toBeNull();
        expect(wholeValueOf({ kind: 'binary', hex: 'ab', length: 1 })).toEqual({ kind: 'binary', hex: 'ab' });
    });

    test('is undefined for a preview and for a pending DEFAULT', () => {
        expect(wholeValueOf({ kind: 'longText', preview: 'abc', length: 9 })).toBeUndefined();
        expect(wholeValueOf({ kind: 'binary', hex: 'ab', length: 9 })).toBeUndefined();
        expect(wholeValueOf({ kind: 'default' })).toBeUndefined();
    });
});

describe('previewValueOf', () => {
    test('is the whole value when there is one', () => {
        expect(previewValueOf('x')).toBe('x');
    });

    test('is the preview text or the bytes read so far', () => {
        expect(previewValueOf({ kind: 'longText', preview: 'abc', length: 9 })).toBe('abc');
        expect(previewValueOf({ kind: 'binary', hex: 'ab', length: 9 })).toEqual({ kind: 'binary', hex: 'ab' });
    });

    test('is null for a DEFAULT', () => {
        expect(previewValueOf({ kind: 'default' })).toBeNull();
    });
});
