import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { createToastStore, elapsedOf, ERROR_MS, LONG_MS, SUCCESS_MS, UNDO_MS, type Toast, type ToastStoreHook } from './toast-store.ts';

describe('createToastStore', () => {
    let useToasts: ToastStoreHook;

    beforeEach(() => {
        jest.useFakeTimers();
        useToasts = createToastStore();
    });

    afterEach(() => {
        for (const toast of useToasts.getState().toasts) {
            useToasts.getState().dismiss(toast.id);
        }

        jest.useRealTimers();
    });

    const ids = (): string[] => useToasts.getState().toasts.map((toast) => toast.id);

    test('a success takes itself away', () => {
        useToasts.getState().show({ id: 'pushed', title: 'Pushed', kind: 'success' });
        jest.advanceTimersByTime(SUCCESS_MS + 1);
        expect(ids()).toEqual([]);
    });

    test('a success with persist still stands after the time a success gets', () => {
        useToasts.getState().show({ id: 'updated', title: 'Updated to version 0.0.9', kind: 'success', persist: true });
        jest.advanceTimersByTime(SUCCESS_MS + 1);
        expect(ids()).toEqual(['updated']);
    });

    test('an update keeps the persist the toast was shown with', () => {
        useToasts.getState().show({ id: 'updated', title: 'Updating', kind: 'progress', persist: true });
        useToasts.getState().update('updated', { kind: 'success' });
        jest.advanceTimersByTime(SUCCESS_MS + 1);
        expect(ids()).toEqual(['updated']);
    });

    test('an offer to undo stays longer than a success, then goes and says so', () => {
        const closed: string[] = [];
        useToasts.getState().show({ id: 'deleted', title: 'Deleted view', kind: 'deleted', onClose: () => closed.push('deleted') });
        jest.advanceTimersByTime(SUCCESS_MS + 1);
        expect(ids()).toEqual(['deleted']);
        jest.advanceTimersByTime(UNDO_MS - SUCCESS_MS);
        expect(ids()).toEqual([]);
        expect(closed).toEqual(['deleted']);
    });

    test('a toast that is dismissed says so once, and its timer never fires after', () => {
        const closed: string[] = [];
        useToasts.getState().show({ id: 'deleted', title: 'Deleted view', kind: 'deleted', onClose: () => closed.push('deleted') });
        useToasts.getState().dismiss('deleted');
        jest.advanceTimersByTime(UNDO_MS + 1);
        expect(closed).toEqual(['deleted']);
    });

    test('an offer to undo carries the deadline of the timer that takes it away', () => {
        jest.setSystemTime(10_000);
        useToasts.getState().show({ id: 'deleted', title: 'Deleted view', kind: 'deleted' });
        const deadline = useToasts.getState().toasts[0]?.deadline;
        expect(deadline).toEqual({ start: 10_000, end: 10_000 + UNDO_MS });
        jest.advanceTimersByTime(UNDO_MS - 1);
        expect(ids()).toEqual(['deleted']);
        jest.advanceTimersByTime(1);
        expect(ids()).toEqual([]);
    });

    test('an update that starts the timer over moves the deadline with it', () => {
        jest.setSystemTime(10_000);
        useToasts.getState().show({ id: 'pushed', title: 'Pushing', kind: 'progress' });
        expect(useToasts.getState().toasts[0]?.deadline).toBeUndefined();
        jest.advanceTimersByTime(3000);
        useToasts.getState().update('pushed', { kind: 'success' });
        expect(useToasts.getState().toasts[0]?.deadline).toEqual({ start: 13_000, end: 13_000 + SUCCESS_MS });
        useToasts.getState().update('pushed', { kind: 'error' });
        expect(useToasts.getState().toasts[0]?.deadline).toEqual({ start: 13_000, end: 13_000 + ERROR_MS });
    });

    test('a failure stays longer than an offer to undo, then goes', () => {
        useToasts.getState().show({ id: 'failed', title: 'Push failed', kind: 'error' });
        jest.advanceTimersByTime(UNDO_MS + 1);
        expect(ids()).toEqual(['failed']);
        jest.advanceTimersByTime(ERROR_MS - UNDO_MS);
        expect(ids()).toEqual([]);
    });

    test('a failure with persist waits for the person', () => {
        useToasts.getState().show({ id: 'asked', title: 'Restart the server?', kind: 'error', persist: true });
        jest.advanceTimersByTime(LONG_MS + 1);
        expect(ids()).toEqual(['asked']);
    });

    test('running work stays until its outcome', () => {
        useToasts.getState().show({ id: 'push', title: 'Pushing', kind: 'progress', action: { label: 'Cancel', run: () => {} } });
        jest.advanceTimersByTime(LONG_MS + 1);
        expect(ids()).toEqual(['push']);
    });

    test('a success with an action stays as long as an offer to undo, and a failure with one as long as a failure', () => {
        useToasts.getState().show({ id: 'shared', title: 'Shared', kind: 'success', action: { label: 'Undo', run: () => {} } });
        useToasts.getState().show({ id: 'failed', title: 'Push failed', kind: 'error', actions: [{ label: 'Retry', run: () => {} }] });
        jest.advanceTimersByTime(SUCCESS_MS + 1);
        expect(ids()).toEqual(['shared', 'failed']);
        jest.advanceTimersByTime(UNDO_MS - SUCCESS_MS);
        expect(ids()).toEqual(['failed']);
        jest.advanceTimersByTime(ERROR_MS - UNDO_MS);
        expect(ids()).toEqual([]);
    });

    test('the app names the time of a toast that names none, and the toast still goes first', () => {
        const withOutput = createToastStore<Toast & { output?: string }>({ lifetimeOf: (toast) => (toast.output === undefined ? undefined : LONG_MS) });
        withOutput.getState().show({ id: 'plain', title: 'Push failed', kind: 'error' });
        withOutput.getState().show({ id: 'output', title: 'Push failed', kind: 'error', output: 'rejected' });
        withOutput.getState().show({ id: 'own', title: 'Push failed', kind: 'error', output: 'rejected', lifetime: 1000 });
        jest.advanceTimersByTime(1001);
        expect(withOutput.getState().toasts.map((toast) => toast.id)).toEqual(['plain', 'output']);
        jest.advanceTimersByTime(ERROR_MS);
        expect(withOutput.getState().toasts.map((toast) => toast.id)).toEqual(['output']);
        jest.advanceTimersByTime(LONG_MS - ERROR_MS);
        expect(withOutput.getState().toasts).toEqual([]);
    });

    test('a held stack keeps its toasts, and a released one gives each the time it had left', () => {
        jest.setSystemTime(10_000);
        useToasts.getState().show({ id: 'pushed', title: 'Pushed', kind: 'success' });
        jest.advanceTimersByTime(1000);
        useToasts.getState().hold();
        expect(useToasts.getState().toasts[0]?.deadline).toEqual({ start: 10_000, end: 10_000 + SUCCESS_MS, pausedAt: 11_000 });
        jest.advanceTimersByTime(LONG_MS);
        expect(ids()).toEqual(['pushed']);
        useToasts.getState().release();
        expect(useToasts.getState().toasts[0]?.deadline).toEqual({ start: 30_000, end: 30_000 + SUCCESS_MS });
        jest.advanceTimersByTime(SUCCESS_MS - 1001);
        expect(ids()).toEqual(['pushed']);
        jest.advanceTimersByTime(1);
        expect(ids()).toEqual([]);
    });

    test('a toast shown into a held stack waits with it', () => {
        useToasts.getState().show({ id: 'first', title: 'Pushed', kind: 'success' });
        useToasts.getState().hold();
        useToasts.getState().show({ id: 'second', title: 'Pulled', kind: 'success' });
        jest.advanceTimersByTime(LONG_MS);
        expect(ids()).toEqual(['first', 'second']);
        useToasts.getState().release();
        jest.advanceTimersByTime(SUCCESS_MS);
        expect(ids()).toEqual([]);
    });

    test('a stack emptied while held is held no more', () => {
        useToasts.getState().show({ id: 'first', title: 'Pushed', kind: 'success' });
        useToasts.getState().hold();
        useToasts.getState().dismiss('first');
        useToasts.getState().show({ id: 'second', title: 'Pulled', kind: 'success' });
        jest.advanceTimersByTime(SUCCESS_MS);
        expect(ids()).toEqual([]);
    });

    test('a failure with a lifetime goes after it, with the deadline of that timer', () => {
        jest.setSystemTime(10_000);
        useToasts.getState().show({ id: 'ping', title: 'New issue', kind: 'error', lifetime: 10_000 });
        expect(useToasts.getState().toasts[0]?.deadline).toEqual({ start: 10_000, end: 20_000 });
        jest.advanceTimersByTime(9_999);
        expect(ids()).toEqual(['ping']);
        jest.advanceTimersByTime(1);
        expect(ids()).toEqual([]);
    });

    test('a lifetime goes before the time of the kind and before persist', () => {
        useToasts.getState().show({ id: 'short', title: 'Deleted view', kind: 'deleted', lifetime: 1000 });
        useToasts.getState().show({ id: 'kept', title: 'Updated', kind: 'success', persist: true, lifetime: 1000 });
        jest.advanceTimersByTime(1001);
        expect(ids()).toEqual([]);
    });

    test('a lifetime longer than a timer holds keeps the toast up, and one of zero or less is the time of the kind', () => {
        useToasts.getState().show({ id: 'forever', title: 'New issue', kind: 'success', lifetime: Infinity });
        useToasts.getState().show({ id: 'zero', title: 'Updated', kind: 'success', lifetime: 0 });
        useToasts.getState().show({ id: 'invalid', title: 'Checked', kind: 'success', lifetime: Number.NaN });
        expect(useToasts.getState().toasts[0]?.deadline).toBeUndefined();
        jest.advanceTimersByTime(1);
        expect(ids()).toEqual(['forever', 'zero', 'invalid']);
        jest.advanceTimersByTime(SUCCESS_MS);
        expect(ids()).toEqual(['forever']);
    });

    test('an update keeps the lifetime the toast was shown with, until it takes it off', () => {
        useToasts.getState().show({ id: 'ping', title: 'Checking', kind: 'progress', lifetime: 1000 });
        useToasts.getState().update('ping', { kind: 'error' });
        expect(useToasts.getState().toasts[0]?.deadline).toBeDefined();
        useToasts.getState().update('ping', { lifetime: undefined });
        jest.advanceTimersByTime(1001);
        expect(ids()).toEqual(['ping']);
    });

    test('a field of the app rides along through an update', () => {
        const withOutput = createToastStore<Toast & { output?: string }>();
        withOutput.getState().show({ id: 'push', title: 'Pushing', kind: 'progress' });
        withOutput.getState().update('push', { kind: 'error', output: 'rejected' });
        expect(withOutput.getState().toasts[0]?.output).toBe('rejected');
    });

    test('two stores keep their own toasts and their own ids', () => {
        const other = createToastStore();
        const first = useToasts.getState().show({ title: 'One', kind: 'error' });
        const second = other.getState().show({ title: 'Two', kind: 'error' });
        expect(first).toBe(second);
        other.getState().dismiss(second);
        expect(ids()).toEqual([first]);
    });
});

describe('elapsedOf', () => {
    const deadline = { start: 1000, end: 1000 + UNDO_MS };

    test('says how far the timer is, so a ring drawn late starts where the timer already is', () => {
        expect(elapsedOf(deadline, 3500)).toBe(2500);
    });

    test('stands still while the timer does', () => {
        expect(elapsedOf({ ...deadline, pausedAt: 2000 }, 3500)).toBe(1000);
    });

    test('stays inside the lifetime', () => {
        expect(elapsedOf(deadline, 500)).toBe(0);
        expect(elapsedOf(deadline, 1000 + UNDO_MS + 200)).toBe(UNDO_MS);
    });
});
