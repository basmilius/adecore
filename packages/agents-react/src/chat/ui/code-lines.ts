/* One colored run of a line, the part of a highlighter's token the code block draws. */
export interface CodeToken {
    content: string;
    color?: string;
    /* The highlighter's bit set: 1 italic, 2 bold, 4 underline, 8 strikethrough. */
    fontStyle?: number;
}

/* Tokenizes `code` as lines, carrying on from `state` when there is one, and answers the state after it. */
export type Tokenize<State> = (code: string, state: State | undefined) => { lines: CodeToken[][]; state: State | undefined };

// Virtual rows unmount offscreen; share this budget across their languages and themes.
const TOKEN_CACHE_BUDGET = 4 * 1024 * 1024;
const TOKEN_CACHE_ENTRIES = 128;

export class TokenCache<State> {
    private readonly entries = new Map<string, { result: ReturnType<Tokenize<State>>; cost: number }>();
    private size = 0;

    wrap(namespace: string, tokenize: Tokenize<State>): Tokenize<State> {
        return (code, state) => {
            if (state !== undefined) {
                return tokenize(code, state);
            }

            const key = `${namespace}\0${code}`;
            const known = this.entries.get(key);

            if (known !== undefined) {
                this.entries.delete(key);
                this.entries.set(key, known);

                return known.result;
            }

            const result = tokenize(code, state);
            // Account for tokens too, so dense code cannot fill the cache with tiny strings.
            const cost = key.length * 2 + result.lines.reduce((sum, line) => sum + line.length * 64, 0);

            if (cost <= TOKEN_CACHE_BUDGET) {
                while (this.entries.size > 0 && (this.size + cost > TOKEN_CACHE_BUDGET || this.entries.size >= TOKEN_CACHE_ENTRIES)) {
                    const oldest = this.entries.keys().next().value!;
                    this.size -= this.entries.get(oldest)!.cost;
                    this.entries.delete(oldest);
                }

                this.entries.set(key, { result, cost });
                this.size += cost;
            }

            return result;
        };
    }
}

/*
 * The lines of a code block that grows at the end. A line that ended keeps the tokens it got, and
 * the grammar state after it is where the next line starts, so a delta tokenizes the lines that are
 * new plus the one still being written, however long the block already is. The last line is always
 * tokenized again, since the next delta may turn it into anything (the start of a comment, a string).
 */
export class IncrementalLines<State> {
    private readonly tokenize: Tokenize<State>;
    // The text of the lines that are kept: empty, or ending in a newline while the block grows.
    private source = '';
    private lines: CodeToken[][] = [];
    private state: State | undefined = undefined;

    constructor(tokenize: Tokenize<State>) {
        this.tokenize = tokenize;
    }

    /* The tokens of every line of `code`; `complete` says nothing more arrives, so the last line is kept too. */
    update(code: string, complete: boolean): CodeToken[][] {
        // A carriage return splits lines in ways a cut at newlines does not see, so that code starts over every time.
        if (code.includes('\r')) {
            this.reset();

            return this.tokenize(code, undefined).lines;
        }

        const end = complete ? code.length : code.lastIndexOf('\n') + 1;
        const stable = code.slice(0, end);
        const continues = (this.source === '' || this.source.endsWith('\n')) && stable.startsWith(this.source);

        if (!continues) {
            this.reset();
        }

        const added = stable.slice(this.source.length);

        if (added !== '') {
            const result = this.tokenize(added.endsWith('\n') ? added.slice(0, -1) : added, this.state);
            this.lines = [...this.lines, ...result.lines];
            this.state = result.state;
            this.source = stable;
        }

        if (complete) {
            return this.lines;
        }

        return [...this.lines, ...this.tokenize(code.slice(end), this.state).lines];
    }

    private reset(): void {
        this.source = '';
        this.lines = [];
        this.state = undefined;
    }
}
