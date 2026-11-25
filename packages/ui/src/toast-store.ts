import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { Shortcut } from './shortcut.ts';

export const SUCCESS_MS = 4000;

// Also the least a toast with an action stays, whatever its kind: a button takes longer to reach than a line to read.
export const UNDO_MS = 8000;

export const ERROR_MS = 12000;

// For news that lands while nobody is looking yet, and for a failure that carries more than a line.
export const LONG_MS = 20000;

// `setTimeout` fires at once past this, so a longer lifetime, `Infinity` too, is a toast that stays.
const LONGEST_TIMER_MS = 2 ** 31 - 1;

/* `deleted` says something went that can still come back, which is what its action is for. */
export type ToastKind = 'progress' | 'success' | 'error' | 'deleted';

export interface ToastAction {
    label: string;
    run(): void;

    /* The key that does the same, printed beside the label. The key itself is bound elsewhere. */
    shortcut?: Shortcut;
}

/* Epoch milliseconds. */
export interface ToastDeadline {
    start: number;
    end: number;

    /* Since when the timer stands still, while the stack is held. */
    pausedAt?: number;
}

export const elapsedOf = (deadline: ToastDeadline, now: number): number =>
    Math.min(Math.max((deadline.pausedAt ?? now) - deadline.start, 0), deadline.end - deadline.start);

/* An app that carries more on a toast extends this and hands its own type to `createToastStore`. */
export interface Toast {
    id: string;
    title: string;
    description?: string;
    kind: ToastKind;
    action?: ToastAction;

    /* Drawn after `action`, in order. */
    actions?: ToastAction[];

    /* How far the work is, from 0 to 1, drawn as a bar under the title. Read only for `progress`. */
    progress?: number;

    /* Waits to be dismissed, whatever its kind: for a toast that asks something only the person can answer. */
    persist?: boolean;

    /* Milliseconds until the toast takes itself away, whatever its kind; over the kind's own lifetime and `persist`. Zero or less is ignored. */
    lifetime?: number;

    /* Whether it ran out or was dismissed. */
    onClose?: () => void;

    /* Set by the store from the timer that takes the toast away, so what counts down on screen is that timer. */
    deadline?: ToastDeadline;
}

export type ToastInput<T extends Toast = Toast> = Omit<T, 'id' | 'deadline'> & { id?: string };

export type ToastPatch<T extends Toast = Toast> = Partial<Omit<T, 'id' | 'deadline'>>;

export interface ToastStore<T extends Toast = Toast> {
    toasts: T[];

    /* Puts one up, or moves the one with this id to what it says now; answers its id. */
    show(toast: ToastInput<T>): string;

    update(id: string, patch: ToastPatch<T>): void;
    dismiss(id: string): void;

    /* Stops every timer where it is, while a person reads the stack or reaches for a button in it. */
    hold(): void;

    /* Lets every timer run on with the time it had left. */
    release(): void;
}

export type ToastStoreHook<T extends Toast = Toast> = UseBoundStore<StoreApi<ToastStore<T>>>;

export interface ToastStoreOptions<T extends Toast = Toast> {
    /* The time a toast gets where it names none itself, for a field only the app knows; undefined leaves it to the kind. */
    lifetimeOf?(toast: T): number | undefined;
}

const KIND_MS = { success: SUCCESS_MS, deleted: UNDO_MS, error: ERROR_MS } as const;

/* A long action keeps one id from progress to its outcome, so a person never watches two cards for one thing. */
export const createToastStore = <T extends Toast = Toast>(options: ToastStoreOptions<T> = {}): ToastStoreHook<T> => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let counter = 0;
    let held = false;

    return create<ToastStore<T>>((set, get) => {
        const stop = (id: string): void => {
            clearTimeout(timers.get(id));
            timers.delete(id);
        };

        const start = (id: string, delay: number): void => {
            timers.set(
                id,
                setTimeout(() => {
                    timers.delete(id);
                    get().dismiss(id);
                }, delay)
            );
        };

        const lifetimeOf = (toast: T): number | null => {
            const own = [toast.lifetime, options.lifetimeOf?.(toast)].find((lifetime) => lifetime !== undefined && lifetime > 0);

            if (own !== undefined) {
                return own;
            }

            const { kind } = toast;

            // Running work ends with its outcome, never on a clock.
            if (toast.persist === true || kind === 'progress') {
                return null;
            }

            const offers = toast.action !== undefined || (toast.actions ?? []).length > 0;

            return offers ? Math.max(KIND_MS[kind], UNDO_MS) : KIND_MS[kind];
        };

        const schedule = (id: string, toast: T): ToastDeadline | undefined => {
            stop(id);
            const lifetime = lifetimeOf(toast);

            if (lifetime === null || lifetime > LONGEST_TIMER_MS) {
                return undefined;
            }

            const now = Date.now();

            if (held) {
                return { start: now, end: now + lifetime, pausedAt: now };
            }

            start(id, lifetime);

            return { start: now, end: now + lifetime };
        };

        return {
            toasts: [],
            show(toast) {
                counter += 1;
                const id = toast.id ?? `toast-${counter}`;
                const next = { ...toast, id } as T;
                next.deadline = schedule(id, next);
                const toasts = get().toasts;
                set({ toasts: toasts.some((entry) => entry.id === id) ? toasts.map((entry) => (entry.id === id ? next : entry)) : [...toasts, next] });

                return id;
            },
            update(id, patch) {
                const current = get().toasts.find((entry) => entry.id === id);

                if (current === undefined) {
                    return;
                }

                const merged: T = { ...current, ...patch };
                const next: T = { ...merged, deadline: schedule(id, merged) };
                set({ toasts: get().toasts.map((entry) => (entry.id === id ? next : entry)) });
            },
            dismiss(id) {
                stop(id);
                const gone = get().toasts.find((entry) => entry.id === id);
                const toasts = get().toasts.filter((entry) => entry.id !== id);
                set({ toasts });

                // An emptied stack has nothing under the pointer to leave, so no release would ever follow.
                if (toasts.length === 0) {
                    held = false;
                }

                gone?.onClose?.();
            },
            hold() {
                if (held) {
                    return;
                }

                held = true;
                const now = Date.now();
                set({
                    toasts: get().toasts.map((toast) => {
                        if (toast.deadline === undefined) {
                            return toast;
                        }

                        stop(toast.id);

                        return { ...toast, deadline: { ...toast.deadline, pausedAt: now } };
                    })
                });
            },
            release() {
                if (!held) {
                    return;
                }

                held = false;
                const now = Date.now();
                set({
                    toasts: get().toasts.map((toast) => {
                        const { deadline } = toast;

                        if (deadline?.pausedAt === undefined) {
                            return toast;
                        }

                        const left = deadline.end - deadline.pausedAt;
                        start(toast.id, left);

                        return { ...toast, deadline: { start: now - (deadline.pausedAt - deadline.start), end: now + left } };
                    })
                });
            }
        };
    });
};
