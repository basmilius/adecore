import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@adecore/ui';
import type { Editor } from '@adecore/editor';
import { ChangeReview, RowHost } from '@adecore/editor-react';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo' } as const;

const SELECTED = '    for (const line of lines) {\n        total += line.price * line.quantity;\n    }\n';
const PROPOSAL = '    total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);\n';

/* A proposed change to lines 6 to 8, drawn in a row under them until a person decides. */
export default function ChangeReviewDemo() {
    const [rows, setRows] = useState<RowHost | null>(null);
    const [decided, setDecided] = useState<string | null>(null);

    const setup = useCallback((editor: Editor) => {
        const host = new RowHost(editor, 'review');
        host.set([{ id: 'proposal', line: 7, placement: 'below', height: 120 }]);
        setRows(host);
        return () => {
            host.clear();
            setRows(null);
        };
    }, []);
    const { host, editor } = useEditor(OPTIONS, setup);

    useSyncExternalStore(rows?.subscribe ?? noSubscription, rows?.getVersion ?? zero, zero);
    useEffect(() => {
        if (decided !== null) {
            rows?.clear();
        }
    }, [decided, rows]);

    const container = rows?.container('proposal');

    return (
        <>
            <EditorFrame
                host={host}
                toolbar={<span className="px-1 text-xs text-text-muted">{decided ?? 'Accept or reject the proposal under line 8.'}</span>}
            />
            {editor !== null &&
                container !== undefined &&
                decided === null &&
                createPortal(
                    <ChangeReview
                        editor={editor}
                        selected={SELECTED}
                        proposal={PROPOSAL}
                        startLine={6}
                        label="Proposed change"
                        className="border-y border-border bg-surface"
                        actions={
                            <div className="flex gap-1 px-2 py-1">
                                <Button size="xs" variant="primary" onClick={() => setDecided('Accepted. The app applies the edit itself.')}>
                                    Accept
                                </Button>
                                <Button size="xs" onClick={() => setDecided('Rejected.')}>
                                    Reject
                                </Button>
                            </div>
                        }
                    />,
                    container
                )}
        </>
    );
}

function noSubscription(): () => void {
    return () => {};
}

function zero(): number {
    return 0;
}
