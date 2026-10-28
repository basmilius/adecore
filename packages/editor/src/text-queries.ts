import type { DocumentModel } from '@adecore/editor-core';
import type { EditorPosition, EditorPostfixOperand, EditorRange, EditorSurroundShape, EditorTextPlace, EditorUnwrapTarget } from './types.ts';

/* How an editor turns the offsets of the text model into positions and back. */
export interface Coordinates {
    positionAt(offset: number): EditorPosition;
    offsetAt(position: EditorPosition): number;
}

function rangeOf(coordinates: Coordinates, from: number, to: number): EditorRange {
    return { start: coordinates.positionAt(from), end: coordinates.positionAt(to) };
}

export function placeAt(model: DocumentModel, coordinates: Coordinates, position: EditorPosition, language: string): EditorTextPlace {
    return model.placeAt(coordinates.offsetAt(position), language);
}

export function postfixOperands(model: DocumentModel, coordinates: Coordinates, dot: EditorPosition, language: string): EditorPostfixOperand[] {
    const at = coordinates.offsetAt(dot);

    return model.postfixOperands(at, language).map((operand) => ({
        range: rangeOf(coordinates, operand.from, operand.from + model.slice(operand.from, at).trimEnd().length),
        statement: operand.statement
    }));
}

export function surroundShape(model: DocumentModel, coordinates: Coordinates, range: EditorRange, language: string): EditorSurroundShape | null {
    const shape = model.surroundShape(coordinates.offsetAt(range.start), coordinates.offsetAt(range.end), language);

    return shape === null ? null : { range: rangeOf(coordinates, shape.from, shape.to), statements: shape.statements, expression: shape.expression };
}

export function unwrapTargets(
    model: DocumentModel,
    coordinates: Coordinates,
    position: EditorPosition,
    language: string,
    indentUnit: string
): EditorUnwrapTarget[] {
    return model.unwrapTargets(coordinates.offsetAt(position), language, indentUnit).map((target) => ({
        kind: target.kind,
        range: rangeOf(coordinates, target.range.from, target.range.to),
        edits: target.edits.map((edit) => ({ range: rangeOf(coordinates, edit.from, edit.to), text: edit.text }))
    }));
}
