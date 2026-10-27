import type { EditPlan, EditSource } from './edit-source.ts';
import { indentText, rangeOf, whitespaceOf } from './line-text.ts';
import { indentationColumn } from './structure.ts';
import type { Selection, TextEdit } from './types.ts';

export type LineOrder = 'sort' | 'reverse' | 'unique';

interface LineRun {
    first: number;
    last: number;
}

/* The runs of lines the selections touch, or every line when nothing is selected. A selection that ends at the start of a line does not touch it. */
function runsOf(source: EditSource, selections: readonly Selection[]): LineRun[] {
    const ranges = selections.map(rangeOf).filter(({ from, to }) => from !== to);
    const wanted = ranges.length > 0 ? ranges : [{ from: 0, to: source.line(source.lineCount - 1).end }];
    const runs: LineRun[] = [];

    for (const { from, to } of [...wanted].sort((left, right) => left.from - right.from)) {
        const first = source.lineAt(from);
        let last = source.lineAt(to);

        if (last > first && source.line(last).start === to) {
            last--;
        }

        const previous = runs.at(-1);

        if (previous !== undefined && first <= previous.last) {
            previous.last = Math.max(previous.last, last);
        } else {
            runs.push({ first, last });
        }
    }

    return runs;
}

function reorder(lines: readonly string[], order: LineOrder): string[] {
    if (order === 'reverse') {
        return [...lines].reverse();
    }

    if (order === 'unique') {
        return [...new Set(lines)];
    }

    return [...lines].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/*
 * Sorts, reverses or dedupes the lines the selections touch, or the whole text with nothing selected,
 * each run of lines on its own. Every line break stays where it was, so a last line without one stays
 * without one. Sorting compares by code unit, so capitals come first, and keeps equal lines in order;
 * dedupe keeps the first of equal lines. A selection keeps its offsets, as far as the text still reaches.
 */
export function planLineOrder(source: EditSource, selections: readonly Selection[], order: LineOrder): EditPlan | null {
    const edits: TextEdit[] = [];
    const runs: { from: number; to: number; length: number }[] = [];

    for (const { first, last } of runsOf(source, selections)) {
        if (last <= first) {
            continue;
        }

        const lines: string[] = [];
        const breaks: string[] = [];

        for (let index = first; index <= last; index++) {
            lines.push(source.line(index).text);

            if (index < last) {
                breaks.push(source.newline(index));
            }
        }

        const result = reorder(lines, order);
        const text = result.map((line, index) => line + (index < result.length - 1 ? breaks[index]! : '')).join('');
        const from = source.line(first).start;
        const to = source.line(last).end;

        if (text !== source.slice(from, to)) {
            edits.push({ from, to, text });
            runs.push({ from, to, length: text.length });
        }
    }

    if (edits.length === 0) {
        return null;
    }

    const place = (offset: number): number => {
        let shift = 0;

        for (const run of runs) {
            if (offset < run.from) {
                break;
            }

            if (offset < run.to) {
                return Math.min(offset, run.from + run.length) + shift;
            }

            shift += run.length - (run.to - run.from);
        }

        return offset + shift;
    };

    return { edits, selections: selections.map((selection) => ({ anchor: place(selection.anchor), head: place(selection.head) })) };
}

/*
 * Rewrites the indentation of the lines the selections touch, or of every line with nothing selected:
 * to spaces with each tab taken to its stop, or to as many tabs as fit and the spaces left over. Only the
 * whitespace a line starts with changes.
 */
export function planConvertIndents(source: EditSource, selections: readonly Selection[], tabSize: number, insertSpaces: boolean): TextEdit[] {
    const edits: TextEdit[] = [];

    for (const { first, last } of runsOf(source, selections)) {
        for (let index = first; index <= last; index++) {
            const line = source.line(index);
            const current = whitespaceOf(line.text);
            const target = indentText(indentationColumn(current, tabSize), { tabSize, insertSpaces });

            if (current !== target) {
                edits.push({ from: line.start, to: line.start + current.length, text: target });
            }
        }
    }

    return edits;
}

/* The indentation a text uses: spaces with the width of one level, or tabs, whose width a text cannot say. */
export interface DetectedIndentation {
    insertSpaces: boolean;
    tabSize?: number;
}

/* Past this many lines the rest says nothing new. */
const DETECT_LINES = 10_000;
const MAX_INDENT_SIZE = 8;

/*
 * Reads the indentation a text already uses, to edit it the same way. Tabs win when more lines start with
 * a tab than with spaces; otherwise the width of one level is the step between a line and a deeper one
 * after it that occurs most often. On a tie the step more indents are a multiple of wins, so a line
 * aligned under a parenthesis does not pass for a level, and then the smaller. The lines inside a block
 * comment that start with a star are left out, since their single space is no level. Null when no line says.
 */
export function detectIndentation(text: string): DetectedIndentation | null {
    const steps = new Map<number, number>();
    const widths: number[] = [];
    let tabs = 0;
    let spaces = 0;
    let previous = 0;
    let count = 0;

    for (const line of text.split(/\r\n|\r|\n/)) {
        if (++count > DETECT_LINES) {
            break;
        }

        const indent = whitespaceOf(line);
        const content = line.slice(indent.length);

        if (content === '' || content.startsWith('*')) {
            continue;
        }

        if (indent.startsWith('\t')) {
            tabs++;
            previous = -1;

            continue;
        }

        if (indent.includes('\t')) {
            previous = -1;

            continue;
        }

        if (indent.length > 0) {
            spaces++;
            widths.push(indent.length);
        }

        const step = indent.length - previous;

        if (previous >= 0 && step > 0 && step <= MAX_INDENT_SIZE) {
            steps.set(step, (steps.get(step) ?? 0) + 1);
        }

        previous = indent.length;
    }

    if (tabs > spaces) {
        return { insertSpaces: false };
    }

    let best: { size: number; uses: number; fits: number } | null = null;

    for (const [size, uses] of steps) {
        const fits = widths.filter((width) => width % size === 0).length;

        if (best === null || uses > best.uses || (uses === best.uses && (fits > best.fits || (fits === best.fits && size < best.size)))) {
            best = { size, uses, fits };
        }
    }

    return best === null ? null : { insertSpaces: true, tabSize: best.size };
}
