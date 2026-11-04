import { describe, expect, test } from 'bun:test';
import { SingleFlight } from './single-flight.ts';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });

    return { promise, resolve, reject };
}

describe('SingleFlight', () => {
    test('a caller that asks while the work runs shares its outcome', async () => {
        const flights = new SingleFlight<string>();
        const gate = deferred<string>();
        let started = 0;
        const work = () => {
            started++;

            return gate.promise;
        };
        const first = flights.run('a', work);
        const second = flights.run('a', work);
        expect(flights.has('a')).toBe(true);
        expect(flights.get('a')).toBe(first);
        gate.resolve('done');

        expect(await Promise.all([first, second])).toEqual(['done', 'done']);
        expect(started).toBe(1);
    });

    test('keys run apart, and a key that settled runs again', async () => {
        const flights = new SingleFlight<number>();
        let runs = 0;
        const work = async () => ++runs;

        expect(await Promise.all([flights.run('a', work), flights.run('b', work)])).toEqual([1, 2]);
        expect(flights.has('a')).toBe(false);
        expect(await flights.run('a', work)).toBe(3);
    });

    test('a failure reaches every caller and frees the key', async () => {
        const flights = new SingleFlight<string>();
        const gate = deferred<string>();
        const first = flights.run('a', () => gate.promise);
        const second = flights.run('a', () => gate.promise);
        gate.reject(new Error('no'));

        await expect(first).rejects.toThrow('no');
        await expect(second).rejects.toThrow('no');
        expect(flights.has('a')).toBe(false);
        expect(await flights.run('a', async () => 'again')).toBe('again');
    });
});
