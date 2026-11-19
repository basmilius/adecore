import type { ReactElement } from 'react';
import ReactMarkdown, { type Options } from 'react-markdown';

// What the cache may hold, counted in the characters of its keys, which hold the text. A parsed tree
// takes some tens of bytes per character, so this keeps it to a few tens of megabytes.
const MAX_CHARACTERS = 500_000;
const MAX_ENTRIES = 1000;

const parsed = new Map<string, ReactElement>();
let characters = 0;

function remember(key: string, element: ReactElement): void {
    parsed.set(key, element);
    characters += key.length;

    for (const [oldest] of parsed) {
        if (characters <= MAX_CHARACTERS && parsed.size <= MAX_ENTRIES) {
            break;
        }

        parsed.delete(oldest);
        characters -= oldest.length;
    }
}

/*
 * Markdown drawn as react-markdown draws it, parsed once for a text a thread showed before, so a
 * thread that mounts again (another chat in the same place, and back) parses none of it. `variant`
 * names everything of `options` besides the text (plugins, their options, components); null leaves
 * the cache out, for text that is still growing. react-markdown's own `Markdown` uses no hooks, so it
 * is called as the function it is, and a parsed tree is the same elements wherever it is drawn: its
 * components read their context when they render.
 */
export function parseMarkdown(variant: string | null, options: Options): ReactElement {
    if (variant === null) {
        return ReactMarkdown(options);
    }

    const key = `${variant}\u0000${options.children ?? ''}`;
    const known = parsed.get(key);

    if (known !== undefined) {
        // Taken out and put back, so the Map's order stays the order of last use.
        parsed.delete(key);
        parsed.set(key, known);

        return known;
    }

    const element = ReactMarkdown(options);
    remember(key, element);

    return element;
}

/* Empties the cache, for a test that counts parses from a clean start. */
export function forgetParsedMarkdown(): void {
    parsed.clear();
    characters = 0;
}
