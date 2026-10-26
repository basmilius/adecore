import type { Ref } from 'react';
import clsx from 'clsx';
import { dropPreviewPath, type DropPreviewShape } from './preview.ts';

export interface DropPreviewProps {
    /* Where the drop would land, in the coordinates of the box the preview fills; null draws nothing. */
    shape: DropPreviewShape | null;

    className?: string;
    ref?: Ref<SVGSVGElement>;
}

/* For an app with a drag layer of its own. It fills its nearest positioned ancestor; the first shape after a null appears in place. */
export function DropPreview({ shape, className, ref }: DropPreviewProps) {
    if (shape === null) {
        return null;
    }

    return (
        <svg ref={ref} className={clsx('ade-drop-preview', className)} width="100%" height="100%" aria-hidden="true">
            <path style={{ d: `path("${dropPreviewPath(shape)}")` }} />
        </svg>
    );
}
