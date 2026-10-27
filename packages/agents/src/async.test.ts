import { afterEach, describe, expect, jest, test } from 'bun:test';
import { cancellableTimeout, unrefTimeout, type Timer } from './async.ts';

afterEach(() => {
    jest.useRealTimers();
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
