import { describe, expect, test } from 'bun:test';
import { WatchedSinks } from './client-sinks.ts';

describe('WatchedSinks', () => {
    test('an event reaches only the clients that watch', () => {
        const sinks = new WatchedSinks<string>();
        const heard: string[] = [];
        sinks.subscribe('a', (event) => heard.push(`a:${event}`));
        sinks.subscribe('b', (event) => heard.push(`b:${event}`));
        sinks.emit('one');
        sinks.watch('b');
        sinks.emit('two');
        sinks.unwatch('b');
        sinks.emit('three');

        expect(heard).toEqual(['b:two']);
    });

    test('a client that unsubscribes stops watching, so a new sink does not inherit it', () => {
        const sinks = new WatchedSinks<string>();
        const heard: string[] = [];
        sinks.watch('a');
        sinks.subscribe('a', (event) => heard.push(event))();
        sinks.subscribe('a', (event) => heard.push(`again:${event}`));
        sinks.emit('one');

        expect(heard).toEqual([]);
    });
});
