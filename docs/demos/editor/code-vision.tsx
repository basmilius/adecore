import { useCallback } from 'react';
import { splitLines } from '@adecore/merge';
import type { Editor } from '@adecore/editor';
import type { EditorLanguage, GitBlameResult } from '@adecore/editor-react';
import type { FakeLanguageService } from '@adecore/editor-react/testing';
import { LanguageFrame } from '../shared/editor-frame.tsx';
import { SAMPLE, useDemoLanguage } from '../shared/editor.ts';
import { respondNavigation, respondSymbols } from '../shared/order-service.ts';

function configure(service: FakeLanguageService): void {
    respondSymbols(service);
    respondNavigation(service);
}

const DAY = 24 * 60 * 60 * 1000;

/* What `git blame` would say about the file on disk: two commits, the second of which wrote the last function. */
const BLAME: GitBlameResult = {
    commits: [
        { hash: 'a1b2c3d4e5', shortHash: 'a1b2c3d', author: 'Ada Lovelace', email: 'ada@example.com', at: Date.now() - 30 * DAY, summary: 'Add order totals' },
        { hash: 'f6e5d4c3b2', shortHash: 'f6e5d4c', author: 'Grace Hopper', email: 'grace@example.com', at: Date.now() - 2 * DAY, summary: 'Describe an order' }
    ],
    lines: splitLines(SAMPLE).map((_line, index) => (index >= 10 ? 1 : 0))
};

export default function CodeVisionDemo() {
    const { project, onMount } = useDemoLanguage(configure);

    const mount = useCallback(
        (editor: Editor, language: EditorLanguage | null) => {
            language?.codeVision.configure({ usages: true, authors: true });
            language?.codeVision.setBlame({ kind: 'ready', blame: BLAME, base: SAMPLE });
            return onMount(editor, language);
        },
        [onMount]
    );

    return (
        <LanguageFrame
            project={project}
            onMount={mount}
            toolbar={<span className="px-1 text-xs text-text-muted">Press the authors above a function, or its usages.</span>}
        />
    );
}
