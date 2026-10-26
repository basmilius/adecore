/* The pure half of `ErrorBoundary`, kept apart so it can be tested without a DOM. */

/* Anything the subtree draws from. A change in any of them means the data may be whole again. */
export type ResetKeys = readonly unknown[];

/* Only a failed boundary resets: comparing keys while the children are fine would remount a terminal or an embedded page on every change. */
export const shouldReset = (failed: boolean, previous: ResetKeys, next: ResetKeys): boolean => {
    if (!failed) {
        return false;
    }

    if (previous.length !== next.length) {
        return true;
    }

    return previous.some((key, i) => !Object.is(key, next[i]));
};

/* A thrown value is not always an Error, and the message has to say something either way. */
export const errorMessageOf = (error: unknown): string => (error instanceof Error ? error.message || error.name : String(error));

/* The text behind the copy button: what a bug report needs, the component stack included. */
export const errorReport = (label: string, error: unknown, componentStack: string | null): string => {
    const stack = error instanceof Error && error.stack ? error.stack : errorMessageOf(error);

    return [label, stack, ...(componentStack ? [`Component stack:${componentStack}`] : [])].join('\n\n');
};
