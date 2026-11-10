import type { EditorMarker, EditorMarkerSeverity, EditorPosition } from '@adecore/editor';
import type { Diagnostic } from '@adecore/lsp';
import { comparePositions, rangeHolds } from './positions.ts';

export interface ProblemCounts {
    readonly error: number;
    readonly warning: number;
    readonly info: number;
}

/* A diagnostic and the language server process that reported it. */
export interface Problem {
    readonly diagnostic: Diagnostic;
    readonly server: string;
}

const SEVERITIES: Record<number, EditorMarkerSeverity> = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' };
const HINT = 4;
const UNNECESSARY = 1;
const DEPRECATED = 2;

/* The scroll track's tip is a line or two, so a long message is cut where it stops being a tip. */
const TICK_MESSAGE_LENGTH = 300;

/* A report that names no severity is an error, which is the safer side to be wrong on. */
export function severityOf(diagnostic: Diagnostic): EditorMarkerSeverity {
    return SEVERITIES[diagnostic.severity ?? 1] ?? 'error';
}

export function markerOf(diagnostic: Diagnostic): EditorMarker {
    return {
        range: diagnostic.range,
        severity: severityOf(diagnostic),
        unnecessary: diagnostic.tags?.includes(UNNECESSARY) === true,
        deprecated: diagnostic.tags?.includes(DEPRECATED) === true,
        message: diagnostic.message.length > TICK_MESSAGE_LENGTH ? `${diagnostic.message.slice(0, TICK_MESSAGE_LENGTH)}…` : diagnostic.message
    };
}

export function problemCountsOf(diagnostics: readonly Diagnostic[]): ProblemCounts {
    const count = (severity: number): number => diagnostics.filter((diagnostic) => (diagnostic.severity ?? 1) === severity).length;

    return { error: count(1), warning: count(2), info: count(3) };
}

/* The problems under a position, worst first. A hint is not a problem, so it is left to the colors and the faded text. */
export function problemsAt(problems: readonly Problem[], position: EditorPosition): Problem[] {
    const rank = (problem: Problem): number => problem.diagnostic.severity ?? 1;

    return problems
        .filter((problem) => (problem.diagnostic.severity ?? 1) < HINT && rangeHolds(problem.diagnostic.range, position))
        .sort((left, right) => rank(left) - rank(right));
}

/* The start of the first problem after the position, or the last one before it when `direction` is back; it wraps round the document. */
export function neighborProblem(problems: readonly Problem[], from: EditorPosition, direction: 1 | -1): Problem | null {
    const candidates = problems
        .filter((problem) => (problem.diagnostic.severity ?? 1) < HINT)
        .sort((left, right) => comparePositions(left.diagnostic.range.start, right.diagnostic.range.start));

    if (candidates.length === 0) {
        return null;
    }

    if (direction === 1) {
        return candidates.find((problem) => comparePositions(problem.diagnostic.range.start, from) > 0) ?? candidates[0]!;
    }

    return [...candidates].reverse().find((problem) => comparePositions(problem.diagnostic.range.start, from) < 0) ?? candidates[candidates.length - 1]!;
}

/* `ts(2551)`, or the code alone, or the source alone, whichever the server gave. */
export function codeLabelOf(diagnostic: Diagnostic): string {
    const code = diagnostic.code === undefined ? '' : String(diagnostic.code);

    if (diagnostic.source !== undefined && code !== '') {
        return `${diagnostic.source}(${code})`;
    }

    return code !== '' ? code : (diagnostic.source ?? '');
}
