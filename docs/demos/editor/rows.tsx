import { useCallback, useState } from 'react';
import type { Editor } from '@adecore/editor';
import { EditorFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useEditor } from '../shared/editor.ts';

const OPTIONS = { text: SAMPLE, language: 'typescript', theme: 'demo' } as const;

const BUTTON = 'h-5 rounded px-1.5 text-xs text-text-muted hover:bg-surface-hover hover:text-text';

export default function RowsDemo() {
    const [said, setSaid] = useState('Press a code vision entry or a button after line 5.');

    const setup = useCallback((editor: Editor) => {
        // A review of one changed line: the old text in a row above it, the new text tinted, buttons after it.
        editor.setWidgets(
            [
                {
                    id: 'removed',
                    line: 4,
                    placement: 'above',
                    render: (container) =>
                        editor.renderCode(container, '    var total = 0;', { firstLine: 5, sign: '-', color: '--editor-deleted', faded: true })
                }
            ],
            'review'
        );
        editor.setLineHighlights([{ startLine: 5, endLine: 5, color: '--editor-added', sign: '+' }]);
        editor.setLineActions(
            [
                {
                    id: 'decide',
                    line: 4,
                    render: (container) => {
                        for (const word of ['Accept', 'Reject']) {
                            const button = container.ownerDocument.createElement('button');
                            button.className = BUTTON;
                            button.textContent = word;
                            button.onclick = () => setSaid(`${word} was pressed.`);
                            container.append(button);
                        }
                    }
                }
            ],
            'review'
        );
        editor.setCodeVision(
            [3, 11].map((line) => ({
                id: `declaration-${line}`,
                line,
                entries: [
                    { id: 'usages', text: line === 3 ? '1 usage' : 'no usages', activate: () => setSaid(`The usages of line ${line + 1} were asked for.`) },
                    { id: 'author', text: 'Ada Lovelace', icon: 'user' as const, activate: () => setSaid(`The author of line ${line + 1} was asked for.`) }
                ]
            }))
        );
    }, []);
    const { host } = useEditor(OPTIONS, setup);

    return <EditorFrame host={host} toolbar={<span className="px-1 text-xs text-text-muted">{said}</span>} />;
}
