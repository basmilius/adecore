/* A field of a frame or a file that no schema promises a string in. */
export function str(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

/* A count of a frame, zero for anything that is not a finite number. */
export function num(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/* The same, with an empty string read as nothing said. */
export function filledStr(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}
