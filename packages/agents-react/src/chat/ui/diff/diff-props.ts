import type { ChatFileChange } from '@adecore/agent-contracts';
import type { DiffSource } from '@adecore/editor-react';
import type { DiffContents } from '../full-diff';

export interface UnifiedDiffProps {
    allowEditor?: boolean;
    maxHeight?: number;
    ignoreWhitespace?: boolean;
    change: ChatFileChange;
    overflow?: 'wrap' | 'scroll';
    /* `split` puts the old and the new side by side; the chat always stacks. */
    diffStyle?: 'unified' | 'split';
    /* Grow to the height of a flex column around it. */
    fill?: boolean;
    /* Both whole texts the patch was made between, with which a person can unfold the lines between hunks. */
    contents?: DiffContents;
    /* Runs per editor of the diff with a way to ask where its caret stands in the new file. Only the editor diff calls it; the plain fallbacks have no caret. */
    onSource?(source: DiffSource): void | (() => void);
}
