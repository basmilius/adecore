import type { Editor, EditorPosition } from '@adecore/editor';

export function lineTextOf(editor: Editor, line: number): string {
    return editor.textInRange({ start: { line, character: 0 }, end: { line, character: Number.MAX_SAFE_INTEGER } });
}

/* The text of a position's line up to the position. */
export function textBeforeOf(editor: Editor, position: EditorPosition): string {
    return editor.textInRange({ start: { line: position.line, character: 0 }, end: position });
}
