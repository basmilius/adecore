import { useCallback, useState } from 'react';
import { AGENT_COLORS, type Editor, type EditorAttributionHover } from '@adecore/editor';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo', line: 10, column: 2 } as const;

const SUGGESTION = '\n\nexport function orderCount(lines: OrderLine[]): number {\n    return lines.length;\n}';

export default function AgentsDemo() {
    const [hover, setHover] = useState<EditorAttributionHover | null>(null);

    const setup = useCallback((editor: Editor) => {
        editor.setAttributionMarks([
            { id: 'pricing', startLine: 4, endLine: 10, color: AGENT_COLORS[0] },
            { id: 'summary', startLine: 12, endLine: 15, color: AGENT_COLORS[1] }
        ]);
        editor.setRemoteCursors([{ id: 'writer', position: { line: 13, character: 11 }, name: 'Writer', color: AGENT_COLORS[1] }]);
        const suggest = (): void =>
            editor.setGhostText({
                position: { line: 9, character: 1 },
                text: SUGGESTION,
                accessory: (container) => {
                    container.textContent = 'Tab';
                }
            });
        suggest();
        const stops = [
            editor.onAttributionHover(setHover),
            // The editor never takes a suggestion itself: the host binds the key and inserts the text.
            editor.onKeyDown((event) => {
                const caret = editor.getCaret();
                if (event.key !== 'Tab' || caret.line !== 9 || caret.character !== 1) {
                    return false;
                }
                return editor.applyEdits([{ range: { start: caret, end: caret }, text: SUGGESTION }]);
            })
        ];
        return () => stops.forEach((stop) => stop());
    }, []);
    const { host } = useEditor(OPTIONS, setup);

    return (
        <EditorFrame
            host={host}
            toolbar={
                <span className="px-1 text-xs text-text-muted">
                    {hover === null
                        ? 'Rest the pointer on a colored bar in the gutter, or press Tab to take the suggestion.'
                        : `The pointer is on the run "${hover.id}".`}
                </span>
            }
        />
    );
}
