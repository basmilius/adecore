import type { EditSource } from './edit-source.ts';

/* The end of the last token before `end`, past the whitespace and the comments between them. */
export function skipTriviaBack(source: EditSource, end: number): number {
    let at = end;

    while (at > 0) {
        const char = source.charAt(at - 1);

        if (/\s/u.test(char)) {
            at--;

            continue;
        }

        // The lexer leaves a block comment at its `*`, so the state before the closing `/` is already code.
        const inside = source.context(char === '/' && at > 1 && source.charAt(at - 2) === '*' ? at - 2 : at - 1);

        if ((inside.mode === 'line-comment' || inside.mode === 'block-comment') && inside.commentStart !== undefined && inside.commentStart < at) {
            at = inside.commentStart;

            continue;
        }

        break;
    }

    return at;
}
