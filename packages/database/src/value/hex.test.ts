import { describe, expect, test } from 'bun:test';
import { bytesOf, decodeUtf8, formatUuid, hexDumpLines, parseHex } from './hex.ts';

describe('parseHex', () => {
    test('takes spaces, newlines, capitals and a 0x prefix', () => {
        expect(parseHex('DE AD\nbe ef')).toEqual({ ok: true, hex: 'deadbeef' });
        expect(parseHex('0xCAFE')).toEqual({ ok: true, hex: 'cafe' });
        expect(parseHex('')).toEqual({ ok: true, hex: '' });
    });

    test('refuses other characters and half a byte', () => {
        expect(parseHex('xyz1')).toEqual({ ok: false, problem: 'characters' });
        expect(parseHex('abc')).toEqual({ ok: false, problem: 'odd' });
    });
});

describe('decodeUtf8', () => {
    test('reads text and lets invalid bytes become replacement characters', () => {
        expect(decodeUtf8('68c3a96c6c6f')).toBe('héllo');
        expect(decodeUtf8('ff41')).toBe('�A');
        expect(bytesOf('00ff')).toEqual(new Uint8Array([0, 255]));
    });
});

describe('formatUuid', () => {
    test('groups exactly 16 bytes', () => {
        expect(formatUuid('550e8400e29b41d4a716446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(formatUuid('550e84')).toBeNull();
    });
});

describe('hexDumpLines', () => {
    test('writes the offset, two groups of eight bytes and the ASCII column', () => {
        const hex = '48656c6c6f2c20776f726c640a00ff01' + '4142';
        expect(hexDumpLines(hex)).toEqual([
            '00000000  48 65 6c 6c 6f 2c 20 77  6f 72 6c 64 0a 00 ff 01  |Hello, world....|',
            '00000010  41 42                                             |AB|'
        ]);
    });

    test('stops at the byte limit', () => {
        expect(hexDumpLines('00'.repeat(40), 16)).toHaveLength(1);
        expect(hexDumpLines('')).toEqual([]);
    });

    test('aligns the ASCII column on a short line', () => {
        const [full, short] = hexDumpLines('00'.repeat(17));
        expect(short!.indexOf('|')).toBe(full!.indexOf('|'));
    });
});
