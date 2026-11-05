import type { Editor, EditorEngine, EditorTheme } from '@adecore/editor';
import type { DiffDocument, DiffSourceLine } from '@adecore/merge';
import type { Ref } from 'react';
import type { DiffLimits } from './diff-expansion.ts';
import type { DiffSourceTokens } from './diff-syntax.ts';

export interface DiffViewProps {
    engine: EditorEngine;
    document: DiffDocument;
    theme: EditorTheme;
    tokens?: DiffSourceTokens;
    wrap?: boolean;
    layout?: 'unified' | 'split';
    /* Above this many displayed unified rows, split uses fixed line heights. Defaults to 2000. */
    splitWrapLimit?: number;
    /* A fixed-height host supplies the height; otherwise the view grows with its rows. */
    fill?: boolean;
    /* Positive pixels; taller content scrolls inside the editor. Ignored with fill. */
    maxHeight?: number;
    /* Total visible source-text budgets after unfolding; changed rows are always retained. */
    unfoldLimits?: DiffLimits;
    label: string;
    /* False draws no line numbers, for a fragment whose place in its file is not known. Defaults to true. */
    numbered?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
    onMount?(editor: Editor, side?: 'old' | 'new'): void | (() => void);
    /* Runs per editor like `onMount`, with a way to ask where its caret stands in the new file, for a host that opens the file there. */
    onSource?(source: DiffSource): void | (() => void);
}

export interface DiffSource {
    readonly editor: Editor;
    /* `old` or `new` in split, absent in unified. */
    readonly side?: 'old' | 'new';
    /* The line and column of the new file under the caret, or null where the new file has none. */
    at(): DiffSourceLine | null;
}
