import { afterEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { cancellableTimeout, unrefTimeout, wait, type Timer } from './async.ts';

afterEach(() => {
    jest.useRealTimers();
});

describe('wait', () => {
    test('resolves at once on a signal raised before the call', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        controller.abort();
        let done = false;
        void wait(60_000, controller.signal).then(() => {
            done = true;
        });
        await Promise.resolve();

        expect(done).toBe(true);
    });

    test('takes its abort listener back once the time is up', async () => {
        jest.useFakeTimers();
        const signal = new AbortController().signal;
        const removing = spyOn(signal, 'removeEventListener');
        const waited = wait(100, signal);
        jest.advanceTimersByTime(100);
        await waited;

        expect(removing.mock.calls.map(([type]) => type)).toEqual(['abort']);
    });
});

describe.each<[string, Timer]>([
    ['cancellableTimeout', cancellableTimeout],
    ['unrefTimeout', unrefTimeout]
])('%s', (_name, timer) => {
    test('runs after the delay', () => {
        jest.useFakeTimers();
        let ran = 0;
        timer(100, () => ran++);
        jest.advanceTimersByTime(99);
        expect(ran).toBe(0);
        jest.advanceTimersByTime(1);

        expect(ran).toBe(1);
    });

    test('the function it answers calls the run off', () => {
        jest.useFakeTimers();
        let ran = 0;
        const cancel = timer(100, () => ran++);
        cancel();
        jest.advanceTimersByTime(200);

        expect(ran).toBe(0);
    });
});
