/* Binary values cross as lowercase hex; these turn it into what a person reads and back. */

export type HexProblem = 'characters' | 'odd';

export type ParsedHex = { readonly ok: true; readonly hex: string } | { readonly ok: false; readonly problem: HexProblem };

export const BYTES_PER_LINE = 16;

const GROUP = 8;
const GROUP_WIDTH = GROUP * 3 - 1;
const NOT_HEX = /[^0-9a-f]/;
const UUID_BYTES = 16;

/* Spaces and newlines may separate the digits, and a leading `0x` is the way the grid writes a binary value. */
export const parseHex = (text: string): ParsedHex => {
    const stripped = text.replace(/\s+/g, '').toLowerCase();
    const hex = stripped.startsWith('0x') ? stripped.slice(2) : stripped;
    if (NOT_HEX.test(hex)) {
        return { ok: false, problem: 'characters' };
    }
    return hex.length % 2 === 0 ? { ok: true, hex } : { ok: false, problem: 'odd' };
};

export const bytesOf = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
};

/* Bytes that are not valid UTF-8 become replacement characters rather than an error. */
export const decodeUtf8 = (hex: string): string => new TextDecoder('utf-8').decode(bytesOf(hex));

/* A UUID is exactly 16 bytes; anything else has no UUID form. */
export const formatUuid = (hex: string): string | null => {
    if (hex.length !== UUID_BYTES * 2) {
        return null;
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const isPrintable = (byte: number): boolean => byte >= 0x20 && byte <= 0x7e;

const slotsOf = (bytes: Uint8Array, from: number, to: number): string =>
    Array.from(bytes.subarray(from, to), (byte) => byte.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(GROUP_WIDTH);

/* One line per 16 bytes: the offset, the bytes in two groups of eight, and the same bytes as ASCII with `.` for what does not print. */
export const hexDumpLines = (hex: string, maxBytes = Number.POSITIVE_INFINITY): string[] => {
    const bytes = bytesOf(hex.slice(0, Math.min(hex.length, maxBytes * 2)));
    const lines: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += BYTES_PER_LINE) {
        const line = bytes.subarray(offset, offset + BYTES_PER_LINE);
        const ascii = Array.from(line, (byte) => (isPrintable(byte) ? String.fromCharCode(byte) : '.')).join('');
        lines.push(
            `${offset.toString(16).padStart(8, '0')}  ${slotsOf(bytes, offset, offset + GROUP)}  ${slotsOf(bytes, offset + GROUP, offset + BYTES_PER_LINE)}  |${ascii}|`
        );
    }
    return lines;
};
