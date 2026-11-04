import { describeError } from '@adecore/utils/errors';

// The host decides once whether a stack is worth showing; the package reads no variable of its own.
let showStacks = false;

export function setErrorStacks(on: boolean): void {
    showStacks = on;
}

/** `describeError` as the host set it, for a log line or a note. */
export function errorText(error: unknown): string {
    return describeError(error, showStacks);
}
