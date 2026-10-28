import { afterEach, describe, expect, test } from 'bun:test';
import { readTerminalFont } from './theme.ts';

const globals = globalThis as unknown as Record<string, unknown>;

const tokens: Record<string, string> = {};

globals.document = { documentElement: {} };
globals.getComputedStyle = () => ({ getPropertyValue: (name: string) => tokens[name] ?? '' });

afterEach(() => {
    for (const name of Object.keys(tokens)) {
        delete tokens[name];
    }
});

describe('the terminal font', () => {
    test('falls back to --font-mono while --term-font is unset or empty', () => {
        tokens['--font-mono'] = ' "Geist Mono", monospace ';

        expect(readTerminalFont()).toBe('"Geist Mono", monospace');

        tokens['--term-font'] = '  ';

        expect(readTerminalFont()).toBe('"Geist Mono", monospace');
    });

    test('prefers --term-font when it is set', () => {
        tokens['--font-mono'] = 'monospace';
        tokens['--term-font'] = '"JetBrains Mono", monospace';

        expect(readTerminalFont()).toBe('"JetBrains Mono", monospace');
    });

    test('reads the tokens again on every call, so a change reaches a live terminal', () => {
        tokens['--font-mono'] = 'monospace';

        expect(readTerminalFont()).toBe('monospace');

        tokens['--term-font'] = '"Fira Code", monospace';

        expect(readTerminalFont()).toBe('"Fira Code", monospace');

        delete tokens['--term-font'];

        expect(readTerminalFont()).toBe('monospace');
    });
});
