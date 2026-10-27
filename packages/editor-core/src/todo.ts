import type { DocumentLine } from './rope.ts';
import { type TypingContext, TypingContexts } from './typing-context.ts';

/* The words a TODO comment starts with when a host names none. */
export const DEFAULT_TODO_WORDS: readonly string[] = ['TODO', 'FIXME'];

/* A TODO in a comment: from its word to the end of the comment on that line. */
export interface TodoMatch {
    from: number;
    to: number;
    /* Zero-based. */
    line: number;
    /* The word of the list it matched, as the list writes it. */
    word: string;
}

export interface TodoOptions {
    /* Matched as whole words in any case. `DEFAULT_TODO_WORDS` without them; an empty list finds nothing. */
    words?: readonly string[];
}

/* What finding the TODOs of a document reads of it. */
export interface TodoSource {
    lineCount: number;
    line(index: number): DocumentLine;
    context(line: number, column: number): TypingContext;
}

const CLOSERS: Partial<Record<TypingContext['mode'], string>> = { 'block-comment': '*/', 'html-comment': '-->' };

function escape(word: string): string {
    return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Null when there is nothing to look for. */
export function todoPattern(words: readonly string[] = DEFAULT_TODO_WORDS): RegExp | null {
    const usable = words.map((word) => word.trim()).filter((word) => word !== '');

    if (usable.length === 0) {
        return null;
    }

    // Longest first, so `TODO` does not stop a list that also has `TODO_LATER` short.
    const alternatives = [...usable].sort((left, right) => right.length - left.length).map(escape);

    return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
}

/*
 * The TODOs on one line. A word counts only where the lexer says a comment is, so one in a string or in
 * code is no TODO, and a second word in the same comment is part of the first one's TODO.
 */
export function todosOnLine(source: TodoSource, index: number, pattern: RegExp, words: readonly string[]): TodoMatch[] {
    const line = source.line(index);
    const result: TodoMatch[] = [];
    pattern.lastIndex = 0;

    for (let found = pattern.exec(line.text); found !== null; found = pattern.exec(line.text)) {
        const context = source.context(index, found.index);
        const closer = CLOSERS[context.mode];

        if (context.mode !== 'line-comment' && closer === undefined) {
            continue;
        }

        const close = closer === undefined ? -1 : line.text.indexOf(closer, found.index + found[0].length);
        const end = close === -1 ? line.text.length : close;
        const word = words.find((candidate) => candidate.trim().toLowerCase() === found[0].toLowerCase()) ?? found[0];
        result.push({ from: line.start + found.index, to: line.start + end, line: index, word: word.trim() });
        pattern.lastIndex = Math.max(pattern.lastIndex, end);
    }

    return result;
}

/* Every TODO of the lines from `first` through `last`, in order. */
export function todosInLines(source: TodoSource, options: TodoOptions = {}, first = 0, last = source.lineCount - 1): TodoMatch[] {
    const words = options.words ?? DEFAULT_TODO_WORDS;
    const pattern = todoPattern(words);

    if (pattern === null) {
        return [];
    }

    const result: TodoMatch[] = [];

    for (let index = Math.max(0, first); index <= Math.min(last, source.lineCount - 1); index++) {
        result.push(...todosOnLine(source, index, pattern, words));
    }

    return result;
}

/*
 * The TODO comments of a text, for a host that lists them. The language decides what a comment is, as
 * it does for the editor's own commands, and a language without comments has none.
 */
export function findTodos(text: string, language: string, options: TodoOptions = {}): TodoMatch[] {
    const lines = splitLines(text);
    const contexts = new TypingContexts((index) => lines[index]!);

    return todosInLines({ lineCount: lines.length, line: (index) => lines[index]!, context: (line, column) => contexts.at(line, column, language) }, options);
}

function splitLines(text: string): DocumentLine[] {
    const lines: DocumentLine[] = [];
    const breaks = /\r\n|\r|\n/g;
    let start = 0;

    for (let found = breaks.exec(text); found !== null; found = breaks.exec(text)) {
        lines.push({ start, end: found.index, next: found.index + found[0].length, text: text.slice(start, found.index) });
        start = found.index + found[0].length;
    }

    lines.push({ start, end: text.length, next: text.length, text: text.slice(start) });

    return lines;
}
