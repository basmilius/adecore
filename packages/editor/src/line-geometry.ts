export type Affinity = 'before' | 'after';

export interface LayoutMetrics {
    lineHeight: number;
    charWidth: number;
    tabSize: number;
    measureText(text: string): number;
    measureInlay(text: string): number;
}

/* Text drawn between two characters of a line, without being part of the document. */
export interface Inlay {
    id: string;
    at: number;
    text: string;
    tooltip?: string;
    /* The text cut into pieces drawn as elements of their own; they add up to `text`. */
    parts?: readonly string[];
    /* Pixels of space kept clear before and after the pill. */
    gapLeft?: number;
    gapRight?: number;
    /* What an input method has composed: drawn as text in the code face, with no padding, so what stands around it does not move. */
    composition?: boolean;
    /* A suggestion the host drew after the caret: text in the code face with no padding, which the caret stays in front of. */
    ghost?: boolean;
    /* A square of this CSS color in place of the text, such as the color a literal in the code stands for. */
    swatch?: string;
}

interface TextRun {
    /* Line-relative offsets let preceding edits move a line without rewriting its runs. */
    from: number;
    to: number;
    x: number;
    /* The visual line of the document line the run is on. */
    subRow: number;
    text: string;
}

interface InlineBox {
    inlay: Inlay;
    x: number;
    width: number;
    subRow: number;
}

/* Where every character of one document line is, relative to the line's own origin. */
export interface LineGeometry {
    start: number;
    end: number;
    next: number;
    text: string;
    /* Uniform ASCII rows share x prefixes instead of allocating these four arrays per character. */
    offsets: number[];
    /* The x of each stop before and after the inlays that sit on it. */
    before: number[];
    after: number[];
    /* The visual line each stop is on. */
    rowOf: number[];
    /* The stop each visual line starts at. */
    rowStarts: number[];
    /* The x each visual line ends at. */
    rowEnds: number[];
    /* The furthest stop a greedy wrap decision read, including its lookahead. */
    rowTriggers: number[];
    uniform?: { first: readonly number[]; continuation: readonly number[] };
    runs: TextRun[];
    inlays: InlineBox[];
    subRows: number;
    width: number;
}
