import { describe, expect, it } from 'bun:test';
import { TextMirror } from './text-mirror.ts';

describe('text mirror', () => {
    it('updates a document of 5.7 MB in well under a millisecond per keystroke', () => {
        const line = 'const value = someFunction(argument, another) + 42; // c\n';
        const lines = Math.ceil(5.7e6 / line.length);
        const mirror = new TextMirror(line.repeat(lines));
        const keystrokes = 1_000;
        const start = performance.now();

        for (let i = 0; i < keystrokes; i++) {
            const at = { line: lines - 2 - (i % 100), character: 0 };
            mirror.applyChanges([{ range: { start: at, end: at }, text: i % 10 === 0 ? '\n' : 'x' }]);
        }

        // Scanning the text up to the change took about 7 ms per keystroke here; this bound is a millisecond.
        expect(performance.now() - start).toBeLessThan(keystrokes);
        expect(mirror.lineCount).toBe(lines + 1 + keystrokes / 10);
    });
});
