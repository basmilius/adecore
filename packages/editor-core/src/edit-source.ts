import type { VueRegion } from './languages.ts';
import type { DocumentLine } from './rope.ts';
import type { Selection, TextEdit } from './types.ts';
import type { TypingContext } from './typing-state.ts';

/* What the editing features that go by the lines around a caret read from the document. */
export interface EditSource {
    slice(from: number, to: number): string;
    charAt(offset: number): string;
    lineAt(offset: number): number;
    lineCount: number;
    line(index: number): DocumentLine;
    newline(index: number): string;
    context(offset: number): TypingContext;
    region(line: number): VueRegion | null;
    /* Whether a `{` at this offset has no closer of its own, so Enter after it adds one. */
    unclosedBrace(offset: number): boolean;
    /* Where the closer of the opening bracket at this offset stands, undefined where the document has none. */
    closerOf(offset: number): number | undefined;
}

/* Edits to apply together and the selections that stand after them. */
export interface EditPlan {
    edits: TextEdit[];
    selections: Selection[];
}
