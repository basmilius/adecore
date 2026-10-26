import { asError } from './error-text.ts';

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

export interface DeadlineTimer {
    setTimeout(run: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}

const SYSTEM_TIMER: DeadlineTimer = {
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

/* The timer is cleared either way, so a call that answers at once does not hold the process until its deadline. */
export function withDeadline<T>(promise: Promise<T>, ms: number, message: string, timer: DeadlineTimer = SYSTEM_TIMER): Promise<T> {
    return new Promise((resolve, reject) => {
        const handle = timer.setTimeout(() => reject(new Error(message)), ms);

        promise.then(
            (value) => {
                timer.clearTimeout(handle);
                resolve(value);
            },
            (e: unknown) => {
                timer.clearTimeout(handle);
                reject(asError(e));
            }
        );
    });
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return withDeadline(promise, ms, message);
}
