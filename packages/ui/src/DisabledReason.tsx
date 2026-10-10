import type { ReactElement } from 'react';
import { Tooltip } from './Tooltip.tsx';

export interface DisabledReasonProps {
    reason: string | null;
    children: ReactElement<Record<string, unknown>>;
}

/*
 * Why a row cannot be picked, in a tooltip beside it rather than in the row itself: a sentence in a menu
 * row sets the width of the whole menu. A row with nothing in its way is handed through untouched.
 */
export function DisabledReason({ reason, children }: DisabledReasonProps) {
    if (reason === null) {
        return children;
    }
    return (
        <Tooltip label={reason} side="right">
            {children}
        </Tooltip>
    );
}
