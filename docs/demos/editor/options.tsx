import { useEffect, useState } from 'react';
import { Switch } from '@adecore/ui';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo', rightMargin: 60 } as const;

export default function EditorOptionsDemo() {
    const { host, editor } = useEditor(OPTIONS);
    const [wrap, setWrap] = useState(false);
    const [guides, setGuides] = useState(true);
    const [whitespace, setWhitespace] = useState(false);
    const [readOnly, setReadOnly] = useState(false);

    useEffect(() => editor?.setWrap(wrap), [editor, wrap]);
    useEffect(() => editor?.setGuides(guides), [editor, guides]);
    useEffect(() => editor?.setWhitespace(whitespace), [editor, whitespace]);
    useEffect(() => editor?.setReadOnly(readOnly, 'This demo is read-only.'), [editor, readOnly]);

    const toggle = (label: string, checked: boolean, onChange: (checked: boolean) => void) => (
        <label className="flex items-center gap-2 px-1 text-xs text-text">
            <Switch label={label} checked={checked} onCheckedChange={onChange} />
            {label}
        </label>
    );

    return (
        <EditorFrame
            host={host}
            className="h-64"
            toolbar={
                <>
                    {toggle('Wrap', wrap, setWrap)}
                    {toggle('Guides', guides, setGuides)}
                    {toggle('Whitespace', whitespace, setWhitespace)}
                    {toggle('Read-only', readOnly, setReadOnly)}
                </>
            }
        />
    );
}
