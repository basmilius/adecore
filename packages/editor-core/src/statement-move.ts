import type { EditPlan, EditSource } from './edit-source.ts';
import { isBraced } from './lexical.ts';
import { indentText, isBlank, whitespaceOf } from './line-text.ts';
import { mapOffset } from './offsets.ts';
import { DECLARATION, declarationBody, METHOD, NOT_METHODS, indentWidth, statementAt, visualWidth } from './statements.ts';
import type { FoldingRange } from './structure.ts';
import type { Selection, TextEdit } from './types.ts';

export interface MoveStatementOptions {
    language: string;
    /* One level of indentation. */
    unit: string;
    tabSize: number;
    /* The folds of the document, a server's included, which set where a body ends. */
    structure: readonly FoldingRange[];
    /* The lines that stand on one row of the screen; a collapsed fold moves whole. */
    lineSpan?: (line: number) => { first: number; last: number };
}

export interface StatementMove extends EditPlan {
    /* The lines that changed place, by their number before (`from`) and after (`to`). */
    moves: { from: number; to: number }[];
}

interface LineRange {
    first: number;
    last: number;
}

/* A line of the result, with the columns its indentation grows by. */
interface Slot {
    line: number;
    shift: number;
}

/* The lines `region` holds after the move, in order. */
/* Where a line of the result starts, how much of it is text and how much of that is indentation. */
interface Placed {
    line: number;
    offset: number;
    length: number;
    text: number;
    indent: number;
}

interface Rearrangement {
    region: LineRange;
    order: Slot[];
}

const INDENTED = /^(python|py|yaml|yml)$/i;
const CONTROL = /^(?:if|else|elseif|for|foreach|while|do|try|catch|finally|switch|with)\b/;

/* How a language moves a statement: by brackets, by indentation, or as plain lines when it has neither. */
export function statementMoveMode(language: string): 'braced' | 'indented' | null {
    return isBraced(language) ? 'braced' : INDENTED.test(language) ? 'indented' : null;
}

function rangeOf(first: number, last: number): number[] {
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
}

function slots(lines: number[], shift = 0): Slot[] {
    return lines.map((line) => ({ line, shift }));
}

function trimmed(source: EditSource, line: number): string {
    return source.line(line).text.trim();
}

function startsWithBrace(source: EditSource, line: number): boolean {
    return trimmed(source, line).startsWith('}');
}

function opensBlock(source: EditSource, line: number): boolean {
    return trimmed(source, line).endsWith('{');
}

/* The header of a block that a statement may leave: a control statement or a bare block, never a function, a class or a literal. */
function isControlHeader(source: EditSource, line: number): boolean {
    const text = trimmed(source, line).replace(/^\}\s*/, '');

    return text === '{' || CONTROL.test(text);
}

class Planner {
    private readonly source: EditSource;
    private readonly options: MoveStatementOptions;
    private readonly unitWidth: number;

    constructor(source: EditSource, options: MoveStatementOptions) {
        this.source = source;
        this.options = options;
        this.unitWidth = visualWidth(options.unit, options.tabSize);
    }

    private widen(range: LineRange): LineRange {
        const span = this.options.lineSpan;

        return span === undefined ? range : { first: Math.min(range.first, span(range.first).first), last: Math.max(range.last, span(range.last).last) };
    }

    private statementAt(line: number): LineRange & { code: number } {
        const { first, code, last } = statementAt(this.source, line, this.options.language, this.options.structure);

        return { ...this.widen({ first, last }), code };
    }

    private indentOf(line: number): number {
        return indentWidth(this.source.line(line).text, this.options.tabSize);
    }

    /* The lines of the statements a selection touches. */
    unitOf(selection: Selection): LineRange {
        const from = Math.min(selection.anchor, selection.head);
        const to = Math.max(selection.anchor, selection.head);
        const first = this.source.lineAt(from);
        let lastLine = this.source.lineAt(to);

        if (lastLine > first && this.source.line(lastLine).start === to) {
            lastLine--;
        }

        if (statementMoveMode(this.options.language) === 'indented') {
            return this.widen({ first, last: this.deeperEnd(lastLine) });
        }

        const start = this.statementAt(first);
        const end = this.statementAt(lastLine);

        return { first: Math.min(start.first, end.first), last: Math.max(start.last, end.last) };
    }

    /* The last line of the block of deeper lines under a line, for a language that nests by indentation. */
    private deeperEnd(line: number): number {
        const indent = this.indentOf(line);
        let last = line;

        for (let next = line + 1; next < this.source.lineCount; next++) {
            if (isBlank(this.source.line(next).text)) {
                continue;
            }

            if (this.indentOf(next) <= indent) {
                break;
            }

            last = next;
        }

        return last;
    }

    private declarationLevel(unit: LineRange): boolean {
        const { source } = this;
        const info = this.statementAt(unit.first);
        const header = trimmed(source, info.code);
        const body = declarationBody(source, source.line(info.code).start);
        const method = body === 'other' ? METHOD.exec(header)?.[1] : undefined;

        return (
            body !== null ||
            DECLARATION.test(header) ||
            (method !== undefined && !NOT_METHODS.has(method)) ||
            this.options.structure.some((range) => range.startLine === info.code && /^(?:function|method|class)-body$/.test(range.role ?? ''))
        );
    }

    plan(unit: LineRange, direction: -1 | 1): Rearrangement | null {
        if (statementMoveMode(this.options.language) === 'indented') {
            return direction === 1 ? this.indentedDown(unit) : this.indentedUp(unit);
        }

        if (this.declarationLevel(unit)) {
            return direction === 1 ? this.declarationDown(unit) : this.declarationUp(unit);
        }

        return direction === 1 ? this.statementDown(unit) : this.statementUp(unit);
    }

    private declarationDown(unit: LineRange): Rearrangement | null {
        const { source } = this;
        let next = unit.last + 1;

        while (next < source.lineCount && isBlank(source.line(next).text)) {
            next++;
        }

        if (next >= source.lineCount || startsWithBrace(source, next)) {
            return null;
        }

        const neighbor = this.statementAt(next);

        if (neighbor.first <= unit.last) {
            return null;
        }

        return {
            region: { first: unit.first, last: neighbor.last },
            order: slots([...rangeOf(neighbor.first, neighbor.last), ...rangeOf(unit.last + 1, neighbor.first - 1), ...rangeOf(unit.first, unit.last)])
        };
    }

    private declarationUp(unit: LineRange): Rearrangement | null {
        const { source } = this;
        let previous = unit.first - 1;

        while (previous >= 0 && isBlank(source.line(previous).text)) {
            previous--;
        }

        if (previous < 0) {
            return null;
        }

        const neighbor = this.statementAt(previous);

        if (neighbor.last >= unit.first) {
            return null;
        }

        return {
            region: { first: neighbor.first, last: unit.last },
            order: slots([...rangeOf(unit.first, unit.last), ...rangeOf(neighbor.last + 1, unit.first - 1), ...rangeOf(neighbor.first, neighbor.last)])
        };
    }

    private statementDown(unit: LineRange): Rearrangement | null {
        const { source } = this;
        const next = unit.last + 1;

        if (next >= source.lineCount) {
            return null;
        }

        const own = rangeOf(unit.first, unit.last);
        const swapWith = (last: number): Rearrangement => ({ region: { first: unit.first, last }, order: slots([...rangeOf(next, last), ...own]) });

        if (isBlank(source.line(next).text)) {
            return swapWith(next);
        }

        if (startsWithBrace(source, next)) {
            // `} else {` ends one block and opens the next, so the statement only steps across it.
            if (opensBlock(source, next)) {
                return swapWith(next);
            }

            return this.leaveDown(unit, next);
        }

        if (/^[)\]]/.test(trimmed(source, next))) {
            return null;
        }

        const neighbor = this.statementAt(next);

        if (neighbor.first !== next) {
            return null;
        }

        const header = this.headerEnd(neighbor);

        if (header !== null) {
            const shift = this.indentOf(neighbor.code) + this.unitWidth - this.indentOf(unit.first);

            return { region: { first: unit.first, last: header }, order: [...slots(rangeOf(next, header)), ...slots(own, shift)] };
        }

        return swapWith(neighbor.last);
    }

    /* The line a block statement opens on, when it has a block to enter. */
    private headerEnd(neighbor: LineRange & { code: number }): number | null {
        const { source } = this;

        if (neighbor.last <= neighbor.code) {
            return null;
        }

        if (opensBlock(source, neighbor.code)) {
            return neighbor.code;
        }

        return neighbor.code + 1 <= neighbor.last && trimmed(source, neighbor.code + 1) === '{' ? neighbor.code + 1 : null;
    }

    private leaveDown(unit: LineRange, closer: number): Rearrangement | null {
        const { source } = this;
        const info = source.line(closer);
        const opener = source.context(info.start + info.text.length - info.text.trimStart().length).bracket;

        if (opener === undefined) {
            return null;
        }

        const owner = this.statementAt(source.lineAt(opener.at));

        if (!isControlHeader(source, owner.code)) {
            return null;
        }

        const shift = this.indentOf(owner.code) - this.indentOf(unit.first);

        return {
            region: { first: unit.first, last: owner.last },
            order: [...slots(rangeOf(closer, owner.last)), ...slots(rangeOf(unit.first, unit.last), shift)]
        };
    }

    private statementUp(unit: LineRange): Rearrangement | null {
        const { source } = this;
        const previous = unit.first - 1;

        if (previous < 0) {
            return null;
        }

        const own = rangeOf(unit.first, unit.last);
        const swapWith = (first: number): Rearrangement => ({ region: { first, last: unit.last }, order: slots([...own, ...rangeOf(first, previous)]) });

        if (isBlank(source.line(previous).text)) {
            return swapWith(previous);
        }

        if (opensBlock(source, previous)) {
            if (startsWithBrace(source, previous)) {
                return swapWith(previous);
            }

            const owner = this.statementAt(previous);

            if (!isControlHeader(source, owner.code)) {
                return null;
            }

            const shift = this.indentOf(owner.code) - this.indentOf(unit.first);

            return {
                region: { first: owner.first, last: unit.last },
                order: [...slots(own, shift), ...slots(rangeOf(owner.first, previous))]
            };
        }

        const neighbor = this.statementAt(previous);

        if (neighbor.last >= unit.first) {
            return null;
        }

        if (neighbor.first < previous && startsWithBrace(source, previous)) {
            const shift = this.indentOf(previous) + this.unitWidth - this.indentOf(unit.first);

            return { region: { first: previous, last: unit.last }, order: [...slots(own, shift), ...slots([previous])] };
        }

        return swapWith(neighbor.first);
    }

    private indentedDown(unit: LineRange): Rearrangement | null {
        const { source } = this;
        const next = unit.last + 1;

        if (next >= source.lineCount) {
            return null;
        }

        const own = rangeOf(unit.first, unit.last);

        if (isBlank(source.line(next).text)) {
            return { region: { first: unit.first, last: next }, order: slots([next, ...own]) };
        }

        if (this.indentOf(next) < this.indentOf(unit.first)) {
            return null;
        }

        const last = this.deeperEnd(next);

        return { region: { first: unit.first, last }, order: slots([...rangeOf(next, last), ...own]) };
    }

    private indentedUp(unit: LineRange): Rearrangement | null {
        const { source } = this;
        const previous = unit.first - 1;

        if (previous < 0) {
            return null;
        }

        const own = rangeOf(unit.first, unit.last);

        if (isBlank(source.line(previous).text)) {
            return { region: { first: previous, last: unit.last }, order: slots([...own, previous]) };
        }

        const indent = this.indentOf(unit.first);

        if (this.indentOf(previous) < indent) {
            return null;
        }

        let first = previous;

        while (first > 0 && (this.indentOf(first) > indent || isBlank(source.line(first).text))) {
            first--;
        }

        if (this.indentOf(first) !== indent) {
            return null;
        }

        return { region: { first, last: unit.last }, order: slots([...own, ...rangeOf(first, previous)]) };
    }
}

/* The text of a line with its indentation grown by `shift` columns; a blank line stays as it is. */
function shifted(text: string, shift: number, options: MoveStatementOptions): string {
    if (shift === 0 || isBlank(text)) {
        return text;
    }

    const indent = whitespaceOf(text);
    const width = Math.max(0, visualWidth(indent, options.tabSize) + shift);

    return indentText(width, { tabSize: options.tabSize, insertSpaces: !options.unit.includes('\t') }) + text.slice(indent.length);
}

/*
 * Moves the statement at each caret past the one before it (-1) or after it (1), into a block the way a person
 * would carry it, or out of one. Null when no caret can move. A language with neither brackets nor indentation
 * to go by is the model's to move by lines.
 */
export function planMoveStatement(
    source: EditSource,
    selections: readonly Selection[],
    direction: -1 | 1,
    options: MoveStatementOptions
): StatementMove | null {
    const planner = new Planner(source, options);
    const units: LineRange[] = [];

    for (const unit of selections.map((selection) => planner.unitOf(selection)).sort((left, right) => left.first - right.first)) {
        const previous = units.at(-1);

        if (previous !== undefined && unit.first <= previous.last + 1) {
            previous.last = Math.max(previous.last, unit.last);
        } else {
            units.push({ ...unit });
        }
    }

    const moves: Rearrangement[] = [];

    for (const unit of units) {
        const move = planner.plan(unit, direction);
        const previous = moves.at(-1);

        // A group whose lines another group is also moving stays where it is.
        if (move !== null && (previous === undefined || move.region.first > previous.region.last)) {
            moves.push(move);
        }
    }

    return moves.length === 0 ? null : apply(source, selections, moves, options);
}

function apply(source: EditSource, selections: readonly Selection[], moves: readonly Rearrangement[], options: MoveStatementOptions): StatementMove {
    const edits: TextEdit[] = [];
    const moved: Placed[][] = [];
    const lines: { from: number; to: number }[] = [];

    const ordered = moves.toSorted((left, right) => left.region.first - right.region.first);

    for (const { region, order } of ordered) {
        const parts: string[] = [];
        const placed: Placed[] = [];
        let at = source.line(region.first).start;

        for (const [index, slot] of order.entries()) {
            const info = source.line(slot.line);
            const target = source.line(region.first + index);
            const text = shifted(info.text, slot.shift, options);
            const ending = source.slice(target.end, target.next);
            parts.push(text, ending);
            placed.push({ line: slot.line, offset: at, length: text.length + ending.length, text: text.length, indent: whitespaceOf(text).length });
            at += text.length + ending.length;

            if (slot.line !== region.first + index) {
                lines.push({ from: slot.line, to: region.first + index });
            }
        }

        edits.push({ from: source.line(region.first).start, to: source.line(region.last).next, text: parts.join('') });
        moved.push(placed);
    }

    const mapPoint = (offset: number, keepWithLineAbove: boolean): number => {
        const line = source.lineAt(keepWithLineAbove ? offset - 1 : offset);
        const index = ordered.findIndex(({ region }) => line >= region.first && line <= region.last);

        if (index < 0) {
            return mapOffset(offset, edits);
        }

        const place = moved[index]!.find((slot) => slot.line === line)!;
        const info = source.line(line);

        if (keepWithLineAbove) {
            return place.offset + place.length;
        }

        const column = offset - info.start;
        const before = whitespaceOf(info.text).length;

        return place.offset + (column >= before ? Math.min(column - before + place.indent, place.text) : Math.min(column, place.indent));
    };

    return {
        edits,
        selections: selections.map((selection) => {
            const from = Math.min(selection.anchor, selection.head);
            const to = Math.max(selection.anchor, selection.head);
            const endsAtLineStart = to > from && source.line(source.lineAt(to)).start === to;
            const start = mapPoint(from, false);
            const end = mapPoint(to, endsAtLineStart);

            return selection.anchor <= selection.head ? { anchor: start, head: end } : { anchor: end, head: start };
        }),
        moves: lines
    };
}
