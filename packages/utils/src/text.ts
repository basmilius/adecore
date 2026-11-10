/* The first half of a surrogate pair, a UTF-16 code unit that cannot stand alone. */
export function isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
}

export function isLowSurrogate(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff;
}
