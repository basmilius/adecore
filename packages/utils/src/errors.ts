/*
 * How a thrown value is read. These helpers use no platform API, so a page imports them as well as a
 * process. A message for a person to read and a host-wide choice to print stacks stay with their owners.
 */

/* Whether `e` carries one of `codes` as its `code`, the way Node and Bun mark a system error. */
export function hasErrorCode(e: unknown, ...codes: string[]): boolean {
    return typeof e === 'object' && e !== null && 'code' in e && codes.includes(e.code as string);
}

export function isNotFound(e: unknown): boolean {
    return hasErrorCode(e, 'ENOENT');
}

/*
 * The message of an error, or its whole stack with `debug` set. Bun prints an Error object with a code
 * frame of its bundle, which in a compiled binary is a few lines of minified source. A string avoids that.
 */
export function describeError(error: unknown, debug: boolean): string {
    if (!(error instanceof Error)) {
        return String(error);
    }

    if (debug) {
        return error.stack ?? `${error.name}: ${error.message}`;
    }

    return error.message === '' ? error.name : error.message;
}

export function asError(thrown: unknown): Error {
    return thrown instanceof Error ? thrown : new Error(String(thrown));
}
