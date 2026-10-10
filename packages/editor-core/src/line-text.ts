import type { Selection } from './types.ts';

/* The spaces and tabs a line starts with. */
export function whitespaceOf(text: string): string {
    return /^[\t ]*/.exec(text)![0];
}

export function isBlank(text: string): boolean {
    return text.trim() === '';
}

/* Indentation `width` columns wide, in tabs as far as they reach when spaces are off. */
export function indentText(width: number, options: { tabSize: number; insertSpaces: boolean }): string {
    if (options.insertSpaces) {
        return ' '.repeat(width);
    }
    return '\t'.repeat(Math.floor(width / options.tabSize)) + ' '.repeat(width % options.tabSize);
}

export function rangeOf(selection: Selection): { from: number; to: number } {
    return { from: Math.min(selection.anchor, selection.head), to: Math.max(selection.anchor, selection.head) };
}
