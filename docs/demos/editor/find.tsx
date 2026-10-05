import { useEffect, useState } from 'react';
import { Button, Input } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { EditorFindState } from '@adecore/editor';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo' } as const;

/* A find bar of the host's own, over the editor's matcher. */
export default function FindDemo() {
    const { host, editor } = useEditor(OPTIONS);
    const [text, setText] = useState('total');
    const [state, setState] = useState<EditorFindState>({ count: 0, current: null });

    useEffect(() => editor?.onFind(setState), [editor]);
    useEffect(() => {
        editor?.find(text === '' ? null : { text, caseSensitive: false, wholeWord: false, regex: false });
    }, [editor, text]);

    return (
        <EditorFrame
            host={host}
            toolbar={
                <>
                    <Input size="sm" aria-label="Find" value={text} onChange={(event) => setText(event.target.value)} className="w-40" />
                    <span className="text-xs text-text-muted">
                        {state.current === null ? 'No matches' : `${formatNumber(state.current + 1)} of ${formatNumber(state.count)}`}
                    </span>
                    <Button size="xs" onClick={() => editor?.findStep(-1)}>
                        Previous
                    </Button>
                    <Button size="xs" onClick={() => editor?.findStep(1)}>
                        Next
                    </Button>
                    <Button size="xs" onClick={() => editor?.selectFindMatches()}>
                        Select all
                    </Button>
                </>
            }
        />
    );
}
