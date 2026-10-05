import { useEffect, useReducer, useState } from 'react';
import { AnchoredPopup } from '@adecore/editor-react';
import { formatNumber } from '@adecore/ui/format';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo', line: 5, column: 9 } as const;

/* A card that follows the caret: click in the editor, then move the caret or scroll. */
export default function AnchoredPopupDemo() {
    const { host, editor } = useEditor(OPTIONS);
    const [, redraw] = useReducer((count: number) => count + 1, 0);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        if (editor === null) {
            return;
        }
        const stops = [
            editor.onCaret(() => {
                setShown(true);
                redraw();
            }),
            editor.onViewChange(redraw),
            editor.onBlur(() => setShown(false))
        ];
        return () => stops.forEach((stop) => stop());
    }, [editor]);

    const caret = shown ? (editor?.getCaret() ?? null) : null;
    const rect = caret === null ? null : editor!.rectAt(caret);

    return (
        <>
            <EditorFrame host={host} />
            {caret !== null && rect !== null && (
                <AnchoredPopup rect={rect} className="px-2.5 py-1.5 text-xs">
                    Line {formatNumber(caret.line + 1)}, column {formatNumber(caret.character + 1)}
                </AnchoredPopup>
            )}
        </>
    );
}
