import { expect, test } from 'bun:test';
import { isHighSurrogate, isLowSurrogate } from './text.ts';

test('tells the two halves of a surrogate pair apart from a code unit that stands alone', () => {
    const pair = '😀';

    expect(isHighSurrogate(pair.charCodeAt(0))).toBe(true);
    expect(isLowSurrogate(pair.charCodeAt(1))).toBe(true);
    expect(isHighSurrogate(pair.charCodeAt(1))).toBe(false);
    expect(isLowSurrogate(pair.charCodeAt(0))).toBe(false);
    expect(isHighSurrogate('a'.charCodeAt(0)) || isLowSurrogate('a'.charCodeAt(0))).toBe(false);
});
