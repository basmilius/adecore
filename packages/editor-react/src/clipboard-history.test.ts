import { describe, expect, test } from 'bun:test';
import { ClipboardHistory, type ClipboardEntry } from './clipboard-history.ts';

function ticking(): () => number {
    let now = 0;

    return () => ++now;
}

function texts(history: ClipboardHistory): string[] {
    return history.entries.map((entry) => entry.text);
}

describe('ClipboardHistory', () => {
    test('keeps the newest copy first and stamps it with the clock', () => {
        const history = new ClipboardHistory({ clock: ticking() });

        history.add('one');
        history.add('two', { wholeLines: true });

        expect(history.entries).toEqual([
            { text: 'two', wholeLines: true, at: 2 },
            { text: 'one', wholeLines: false, at: 1 }
        ]);
    });

    test('moves a text that is copied again to the top and ignores an empty one', () => {
        const history = new ClipboardHistory();

        history.add('one');
        history.add('two');
        history.add('one');
        history.add('');

        expect(texts(history)).toEqual(['one', 'two']);
    });

    test('forgets the oldest entries past the limit, 100 by default', () => {
        const small = new ClipboardHistory({ limit: 2 });

        for (const text of ['a', 'b', 'c']) {
            small.add(text);
        }

        expect(texts(small)).toEqual(['c', 'b']);

        const history = new ClipboardHistory();

        for (let i = 0; i < 120; i++) {
            history.add(`copy ${i}`);
        }

        expect(history.entries).toHaveLength(100);
    });

    test('forgets the oldest entries past the total length and keeps the newest even when it is longer', () => {
        const history = new ClipboardHistory({ maxLength: 10 });

        history.add('aaaa');
        history.add('bbbb');
        history.add('cccc');

        expect(texts(history)).toEqual(['cccc', 'bbbb']);

        history.add('x'.repeat(30));

        expect(texts(history)).toEqual(['x'.repeat(30)]);
    });

    test('starts from the entries a host kept, within its limits', () => {
        const kept: ClipboardEntry[] = [
            { text: 'new', wholeLines: false, at: 3 },
            { text: 'mid', wholeLines: true, at: 2 },
            { text: 'old', wholeLines: false, at: 1 }
        ];

        expect(texts(new ClipboardHistory({ entries: kept }))).toEqual(['new', 'mid', 'old']);
        expect(texts(new ClipboardHistory({ entries: kept, limit: 2 }))).toEqual(['new', 'mid']);
    });

    test('removes, promotes and clears entries', () => {
        const history = new ClipboardHistory();

        history.add('one');
        history.add('two');
        history.add('three');
        history.promote(history.entries[2]!);

        expect(texts(history)).toEqual(['one', 'three', 'two']);

        history.remove(history.entries[1]!);

        expect(texts(history)).toEqual(['one', 'two']);

        history.clear();

        expect(history.entries).toEqual([]);
    });

    test('tells the host and the subscribers after every change, and not after a no-op', () => {
        const told: string[][] = [];
        let heard = 0;
        const history = new ClipboardHistory({ onChange: (entries) => told.push(entries.map((entry) => entry.text)) });
        const stop = history.subscribe(() => heard++);

        history.add('one');
        history.add('');
        history.promote(history.entries[0]!);
        history.clear();
        history.clear();
        stop();
        history.add('two');

        expect(told).toEqual([['one'], [], ['two']]);
        expect(heard).toBe(2);
    });
});
