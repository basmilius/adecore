import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import {
    formatBytes,
    formatDecimal,
    formatFixed,
    formatMoney,
    formatNumber,
    formatNumeral,
    formatPercent,
    formatRounded,
    formatTokens,
    formatUsdSignificant
} from './number.ts';
import { FORMAT_SYSTEM } from './regions.ts';
import { fakeFormatSource } from '../testing/fake-source.ts';
import { setFormatSource, type FormatSource } from './locale.ts';

const source = fakeFormatSource();
let previous: FormatSource;

beforeAll(() => {
    previous = setFormatSource(source);
});

afterAll(() => {
    setFormatSource(previous);
});

const inRegion = (region: string): void => {
    source.set({ region });
};

afterEach(() => {
    inRegion(FORMAT_SYSTEM);
});

describe('a number', () => {
    test('groups and separates the way the region writes one', () => {
        inRegion('nl-NL');
        expect(formatNumber(1_234_567)).toBe('1.234.567');
        expect(formatDecimal(1.5)).toBe('1,5');
        inRegion('en-US');
        expect(formatNumber(1_234_567)).toBe('1,234,567');
        expect(formatDecimal(1.5)).toBe('1.5');
    });

    test('keeps the decimal only where it still says something', () => {
        inRegion('nl-NL');
        expect(formatPercent(8.5)).toBe('8,5%');
        expect(formatPercent(42.4)).toBe('42%');
    });
});

describe('a number with a fixed precision', () => {
    test('carries every place it is asked for, also a trailing zero', () => {
        inRegion('nl-NL');
        expect(formatFixed(1, 1)).toBe('1,0');
        expect(formatFixed(1.25, 2)).toBe('1,25');
        expect(formatFixed(2, 0)).toBe('2');
        inRegion('en-US');
        expect(formatFixed(1.5, 2)).toBe('1.50');
    });
});

describe('a token count', () => {
    test('is read as a size, to one decimal until the decimal stops saying anything', () => {
        inRegion('en-US');
        expect(formatTokens(640)).toBe('640');
        expect(formatTokens(412_000)).toBe('412K');
        expect(formatTokens(1_240_000)).toBe('1.2M');
        expect(formatTokens(11_900_000)).toBe('12M');
    });

    test('writes its decimal the way the region does', () => {
        inRegion('nl-NL');
        expect(formatTokens(1_240_000)).toBe('1,2M');
    });
});

describe('an amount of money', () => {
    // A Dutch region writes a dollar as `US$` unless the symbol is asked for narrow, which is a
    // currency lesson nobody wants in a table of prices. The space after it is the one that never
    // breaks, which is what keeps a symbol and its amount on the same line of a narrow column.
    test('wears the plain symbol of its currency in every region', () => {
        inRegion('nl-NL');
        expect(formatMoney(5480.96, 'USD')).toBe('$\u00a05.480,96');
        expect(formatMoney(5480.96, 'EUR')).toBe('€\u00a05.480,96');
        inRegion('en-US');
        expect(formatMoney(5480.96, 'USD')).toBe('$5,480.96');
    });

    test('takes more decimals where two of them would read as zero', () => {
        inRegion('nl-NL');
        expect(formatMoney(0.0032, 'USD', 4)).toBe('$\u00a00,0032');
    });
});

describe('a size', () => {
    test('carries one decimal under ten and none above it', () => {
        inRegion('nl-NL');
        expect(formatBytes(1536)).toBe('1,5 KB');
        expect(formatBytes(1024 * 1024 * 42)).toBe('42 MB');
    });

    test('is whole bytes below a kilobyte, whatever the region', () => {
        inRegion('en-US');
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(1536, true)).toBe('2 KB');
    });
});

describe('dollars to significant digits', () => {
    test('keep what a cent would round away and drop what a dollar does not need', () => {
        inRegion('en-US');
        expect(formatUsdSignificant(0.004)).toBe('$0.004');
        expect(formatUsdSignificant(0.0683)).toBe('$0.0683');
        expect(formatUsdSignificant(7.634)).toBe('$7.63');
        expect(formatUsdSignificant(10)).toBe('$10');
        inRegion('nl-NL');
        expect(formatUsdSignificant(0.55)).toBe('$\u00a00,55');
    });
});

describe('a figure to at most some decimals', () => {
    test('drops the fraction that is not there', () => {
        inRegion('nl-NL');
        expect(formatRounded(39, 2)).toBe('39');
        expect(formatRounded(1.95, 2)).toBe('1,95');
        expect(formatRounded(1.998, 2)).toBe('2');
        inRegion('en-US');
        expect(formatRounded(1234.5, 2)).toBe('1,234.5');
    });
});

describe('a numeral from a database', () => {
    test('keeps every digit a double would round away', () => {
        inRegion('en-US');
        expect(formatNumeral('9007199254740993')).toBe('9,007,199,254,740,993');
        expect(formatNumeral('12345678901234567890.123456789')).toBe('12,345,678,901,234,567,890.123456789');
    });

    test('keeps the decimals it was written with, in the region notation', () => {
        inRegion('nl-NL');
        expect(formatNumeral('-0.50')).toBe('-0,50');
        expect(formatNumeral('12900')).toBe('12.900');
        expect(formatNumeral(1.5)).toBe('1,5');
    });

    test('leaves text that is no plain numeral alone', () => {
        expect(formatNumeral('NaN')).toBe('NaN');
        expect(formatNumeral('1e999')).toBe('1e999');
        expect(formatNumeral('Infinity')).toBe('Infinity');
    });
});
