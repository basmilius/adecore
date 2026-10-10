/*
 * Resolves after `ms`, or at once when the signal is raised. An abort resolves instead of rejecting:
 * every caller is a loop that checks the signal itself on its next turn.
 */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true }
        );
    });
}

/* The timer is cleared either way, so a call that answers at once does not hold the process until its deadline. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (e: unknown) => {
                clearTimeout(timer);
                reject(e instanceof Error ? e : new Error(String(e)));
            }
        );
    });
}
