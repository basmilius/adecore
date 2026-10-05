import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo', foldOutline: 'always' } as const;

/* Type, fold a block in the gutter, add a caret with Alt and click, or undo with Mod+Z. */
export default function EditorDemo() {
    const { host } = useEditor(OPTIONS);

    return <EditorFrame host={host} />;
}
