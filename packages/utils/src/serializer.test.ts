import { describe, expect, test } from 'bun:test';
import { KeyedSerializer, Serializer } from './serializer.ts';

describe('Serializer', () => {
    test('runs the next work once the one before settled, also after a rejection', async () => {
        const serializer = new Serializer();
        const seen: number[] = [];
        const first = serializer.run(async () => {
            seen.push(1);
            throw new Error('boom');
        });
        const second = serializer.run(async () => {
            seen.push(2);

            return 2;
        });

        await expect(first).rejects.toThrow('boom');
        expect(await second).toBe(2);
        expect(seen).toEqual([1, 2]);
        await expect(serializer.idle()).resolves.toBeUndefined();
    });
});

describe('KeyedSerializer', () => {
    test('keeps the order of one key, also after a rejection', async () => {
        const serializer = new KeyedSerializer();
        const seen: number[] = [];
        const first = serializer.run('a', async () => {
            seen.push(1);
            throw new Error('boom');
        });
        const second = serializer.run('a', async () => {
            seen.push(2);

            return 2;
        });

        await expect(first).rejects.toThrow('boom');
        expect(await second).toBe(2);
        expect(seen).toEqual([1, 2]);
    });

    test('forgets every key once its work has settled', async () => {
        const serializer = new KeyedSerializer();

        await Promise.all(Array.from({ length: 10_000 }, (_, i) => serializer.run(`key-${i}`, async () => i)));
        await Promise.resolve();

        expect(serializer.size).toBe(0);
    });

    test('a key queued again while running keeps its place and its entry', async () => {
        const serializer = new KeyedSerializer();
        const seen: string[] = [];
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const first = serializer.run('a', async () => {
            await gate;
            seen.push('first');
        });
        const second = serializer.run('a', async () => {
            seen.push('second');
        });

        expect(serializer.size).toBe(1);

        release();
        await Promise.all([first, second]);
        await Promise.resolve();

        expect(seen).toEqual(['first', 'second']);
        expect(serializer.size).toBe(0);
    });
});
