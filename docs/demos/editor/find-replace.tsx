import { FindReplace } from '@adecore/editor-react';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo' } as const;

export default function FindReplaceDemo() {
    const { host, editor } = useEditor(OPTIONS);

    return <EditorFrame host={host} toolbar={editor === null ? undefined : <FindReplace editor={editor} className="w-full" />} />;
}
