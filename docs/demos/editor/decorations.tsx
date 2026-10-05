import { useCallback, useState } from 'react';
import type { Editor } from '@adecore/editor';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo' } as const;

const range = (line: number, from: number, to: number) => ({ start: { line, character: from }, end: { line, character: to } });

/* What a language server and a version control system would hand the editor, set once by hand. */
function decorate(editor: Editor): void {
    editor.setMarkers([
        { range: range(3, 34, 43), severity: 'error', message: "Cannot find name 'OrderLine'." },
        { range: range(6, 35, 43), severity: 'warning', deprecated: true, message: "'quantity' is deprecated." }
    ]);
    editor.setInlayHints([
        { position: { line: 4, character: 13 }, label: ': number' },
        { position: { line: 12, character: 29 }, label: 'lines:' }
    ]);
    editor.setHighlights([
        { range: range(4, 8, 13), kind: 'write' },
        { range: range(6, 8, 13), kind: 'write' },
        { range: range(8, 11, 16), kind: 'read' }
    ]);
    editor.setChangeMarks([
        { kind: 'modified', startLine: 7, endLine: 7 },
        { kind: 'added', startLine: 12, endLine: 15 }
    ]);
    editor.setGutterAction({ line: 3, label: 'Show fixes' });
}

export default function DecorationsDemo() {
    const [pressed, setPressed] = useState<number | null>(null);
    const setup = useCallback((editor: Editor) => {
        decorate(editor);
        return editor.onGutterAction(setPressed);
    }, []);
    const { host } = useEditor(OPTIONS, setup);

    return (
        <EditorFrame
            host={host}
            toolbar={
                <span className="px-1 text-xs text-text-muted">
                    {pressed === null ? 'Press the button in the gutter of line 4.' : `The gutter action of line ${pressed + 1} was pressed.`}
                </span>
            }
        />
    );
}
