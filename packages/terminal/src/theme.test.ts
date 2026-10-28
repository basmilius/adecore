import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readTerminalFont } from './theme.ts';

const globals = globalThis as unknown as Record<string, unknown>;
const tokens: Record<string, string> = {};
const original = { document: globals.document, getComputedStyle: globals.getComputedStyle };

// Other suites run in the same process and look for a real document, so the stand-ins are put back.
beforeAll(() => {
    globals.document = { documentElement: {} };
    globals.getComputedStyle = () => ({ getPropertyValue: (name: string) => tokens[name] ?? '' });
});

afterAll(() => {
    globals.document = original.document;
    globals.getComputedStyle = original.getComputedStyle;
});

describe('the terminal font', () => {
    test('falls back to --font-mono while --term-font is unset or empty', () => {
        tokens['--font-mono'] = ' "Geist Mono", monospace ';
        delete tokens['--term-font'];

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
        delete tokens['--term-font'];

        expect(readTerminalFont()).toBe('monospace');

        tokens['--term-font'] = '"Fira Code", monospace';

        expect(readTerminalFont()).toBe('"Fira Code", monospace');

        delete tokens['--term-font'];

        expect(readTerminalFont()).toBe('monospace');
    });
});
