import { describe, expect, test } from 'bun:test';
import { createHighlighter } from 'shiki/bundle/web';
import { IncrementalLines, TokenCache, type CodeToken, type Tokenize } from './code-lines';

/* A tokenizer that turns every line into one token and records what it was asked to read. */
function recording() {
    const calls: string[] = [];

    const tokenize: Tokenize<number> = (code, state) => {
        calls.push(code);
        const lines = code.split('\n').map((line) => [{ content: line }]);

        return { lines, state: (state ?? 0) + lines.length };
    };

    return { calls, tokenize };
}

function contents(lines: CodeToken[][]): string[] {
    return lines.map((line) => line.map((token) => token.content).join(''));
}

describe('IncrementalLines', () => {
    test('a growing block tokenizes only the lines that ended since the last update and the one being written', () => {
        const { calls, tokenize } = recording();
        const lines = new IncrementalLines(tokenize);

        expect(contents(lines.update('const a', false))).toEqual(['const a']);
        expect(contents(lines.update('const a = 1;\nconst b', false))).toEqual(['const a = 1;', 'const b']);
        expect(contents(lines.update('const a = 1;\nconst b = 2;\nlet c', false))).toEqual(['const a = 1;', 'const b = 2;', 'let c']);

        expect(calls).toEqual(['const a', 'const a = 1;', 'const b', 'const b = 2;', 'let c']);
    });

    test('the work per update stays the same however long the block already is', () => {
        const { calls, tokenize } = recording();
        const lines = new IncrementalLines(tokenize);
        let code = '';

        for (let i = 0; i < 200; i++) {
            code += `line ${i}\n`;
            lines.update(`${code}next`, false);
        }

        const last = calls.slice(-2);
        expect(last).toEqual(['line 199', 'next']);
        expect(lines.update(`${code}next`, false)).toHaveLength(201);
    });

    test('closing keeps the lines and tokenizes the last one once more', () => {
        const { calls, tokenize } = recording();
        const lines = new IncrementalLines(tokenize);
        lines.update('a\nb', false);
        calls.length = 0;
        expect(contents(lines.update('a\nb', true))).toEqual(['a', 'b']);
        expect(calls).toEqual(['b']);
    });

    test('a text that is not a continuation starts over', () => {
        const { calls, tokenize } = recording();
        const lines = new IncrementalLines(tokenize);
        lines.update('one\ntwo\n', false);
        calls.length = 0;
        expect(contents(lines.update('other\n', false))).toEqual(['other', '']);
        expect(calls).toEqual(['other', '']);
    });

    test('a carriage return tokenizes the whole block every time', () => {
        const { calls, tokenize } = recording();
        const lines = new IncrementalLines(tokenize);
        lines.update('a\r\nb', false);
        expect(calls).toEqual(['a\r\nb']);
    });

    test('with shiki, a comment and a template string across increments color the same as the whole block at once', async () => {
        const highlighter = await createHighlighter({ themes: ['github-dark'], langs: ['ts'] });
        const options = { lang: 'ts', theme: 'github-dark' } as const;

        const tokenize: Tokenize<ReturnType<typeof highlighter.getLastGrammarState>> = (code, state) => {
            const result = highlighter.codeToTokens(code, { ...options, ...(state ? { grammarState: state } : {}) });

            return { lines: result.tokens, state: result.grammarState };
        };

        const code = 'const a = 1;\n/* opens\nstill a comment */\nconst s = `x\n${a}`;\nlet b = 2;';
        const lines = new IncrementalLines(tokenize);
        let streamed: CodeToken[][] = [];

        for (let i = 1; i <= code.length; i++) {
            streamed = lines.update(code.slice(0, i), i === code.length);
        }

        const colors = (tokens: CodeToken[][]) => tokens.map((line) => line.map((token) => [token.content, token.color]));

        expect(colors(streamed)).toEqual(colors(highlighter.codeToTokens(code, options).tokens));
    });
});

describe('TokenCache', () => {
    test('returning to a finished block reuses its tokens', () => {
        const { calls, tokenize } = recording();
        const cached = new TokenCache<number>().wrap('typescript:dark', tokenize);
        const first = new IncrementalLines(cached).update('first\nsecond', true);
        const returning = new IncrementalLines(cached);
        expect(returning.update('first\nsecond', true)).toEqual(first);
        expect(calls).toEqual(['first\nsecond']);
        expect(contents(returning.update('first\nsecond\nthird', true))).toEqual(['first', 'second', 'third']);
    });

    test('grammar continuations and other language or theme namespaces never use another result', () => {
        const { calls, tokenize } = recording();
        const cache = new TokenCache<number>();
        const dark = cache.wrap('typescript:dark', tokenize);
        const light = cache.wrap('typescript:light', tokenize);
        expect(dark('same', undefined).state).toBe(1);
        expect(dark('same', 5).state).toBe(6);
        expect(dark('same', undefined).state).toBe(1);
        expect(light('same', undefined).state).toBe(1);
        expect(calls).toEqual(['same', 'same', 'same']);
    });

    test('recent blocks survive entry eviction and oversized blocks never evict them', () => {
        const { calls, tokenize } = recording();
        const cached = new TokenCache<number>().wrap('text', tokenize);

        for (let i = 0; i < 128; i++) {
            cached(String(i), undefined);
        }

        cached('0', undefined);
        cached('new', undefined);
        calls.length = 0;
        cached('0', undefined);
        cached('1', undefined);
        expect(calls).toEqual(['1']);
        const oversized = 'x'.repeat(3 * 1024 * 1024);
        cached(oversized, undefined);
        cached(oversized, undefined);
        calls.length = 0;
        cached('0', undefined);
        expect(calls).toEqual([]);
    });

    test('dense token streams also evict blocks to stay within the shared budget', () => {
        let calls = 0;

        const tokenize: Tokenize<never> = (code) => {
            calls++;

            return { lines: [Array.from({ length: 40000 }, () => ({ content: code }))], state: undefined };
        };

        const cache = new TokenCache<never>();
        const first = cache.wrap('one', tokenize);
        const second = cache.wrap('two', tokenize);
        first('code', undefined);
        second('code', undefined);
        first('code', undefined);
        expect(calls).toBe(3);
    });
});

test('cached Shiki tokens retain multiline grammar state across remounts', async () => {
    const highlighter = await createHighlighter({ themes: ['github-dark'], langs: ['ts'] });

    try {
        type State = ReturnType<typeof highlighter.getLastGrammarState>;
        const options = { lang: 'ts', theme: 'github-dark' } as const;
        let calls = 0;

        const tokenize: Tokenize<State> = (code, state) => {
            calls++;
            const result = highlighter.codeToTokens(code, { ...options, ...(state ? { grammarState: state } : {}) });

            return { lines: result.tokens, state: result.grammarState };
        };

        const cached = new TokenCache<State>().wrap('ts:github-dark', tokenize);
        const prefix = '/* open\nstill open\n';
        const suffix = 'closed */\nconst value = 1;';
        new IncrementalLines(cached).update(prefix, false);
        const returning = new IncrementalLines(cached);
        returning.update(prefix, false);
        expect(calls).toBe(3);
        const result = returning.update(prefix + suffix, true);
        const fresh = highlighter.codeToTokens(prefix + suffix, options).tokens;

        const colors = (lines: CodeToken[][]) => lines.map((line) => line.map(({ content, color, fontStyle }) => ({ content, color, fontStyle })));

        expect(colors(result)).toEqual(colors(fresh));
    } finally {
        highlighter.dispose();
    }
});
