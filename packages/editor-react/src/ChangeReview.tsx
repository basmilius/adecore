import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Editor } from '@adecore/editor';
import { diffSegments, emphasisOf } from './proposal-model.ts';

export interface ChangeReviewProps {
    editor: Editor;
    selected: string;
    proposal: string;
    startLine?: number;
    actions?: ReactNode;
    className?: string;
    label: string;
}

export function ChangeReview({ editor, selected, proposal, startLine = 1, actions, className, label }: ChangeReviewProps) {
    const code = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const element = code.current;
        if (element === null) {
            return;
        }
        element.replaceChildren();
        for (const segment of diffSegments(selected, proposal, startLine)) {
            const row = element.ownerDocument.createElement('div');
            element.append(row);
            editor.renderCode(row, segment.text, {
                firstLine: segment.firstLine,
                ...(segment.kind === 'same'
                    ? {}
                    : { sign: segment.kind === 'removed' ? '-' : '+', color: segment.kind === 'removed' ? '--editor-deleted' : '--editor-added' }),
                faded: segment.kind === 'removed',
                emphasis: emphasisOf(segment)
            });
        }
        return () => element.replaceChildren();
    }, [editor, selected, proposal, startLine]);
    return (
        <section className={className} aria-label={label}>
            <div ref={code} />
            {actions}
        </section>
    );
}
