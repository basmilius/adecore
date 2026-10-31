import { Fragment, type ComponentType } from 'react';
import type { ReferenceIconProps } from '../../host';
import type { ReferenceStep } from '../chat-references';
import { referenceGlyph } from './reference-icons';

interface ReferenceTrailProps {
    trail: readonly ReferenceStep[];
    hostIcon: ComponentType<ReferenceIconProps> | null | undefined;
    size: number;
    /* What sets a mark on the line, on a box around it, so it holds for whichever mark the host draws. */
    iconClassName: string;
}

/*
 * Where a reference stands, in front of its own mark. Each place may shorten, so the name it leads to
 * stays whole. The chevron runs the height of the pill: a line tall as the text plus the pill's 2px
 * padding on either side, which the negative margins keep out of the height of the line.
 */
export function ReferenceTrail({ trail, hostIcon, size, iconClassName }: ReferenceTrailProps) {
    return (
        <span className="font-normal text-text-muted">
            {trail.map((step) => (
                <Fragment key={step.id}>
                    <span className={iconClassName}>{referenceGlyph(hostIcon, { id: step.id, kind: step.kind, size })}</span>
                    <span className="inline-block max-w-40 truncate align-bottom">{step.name}</span>
                    <svg
                        aria-hidden
                        viewBox="0 0 8 24"
                        preserveAspectRatio="none"
                        className="mx-1 -my-0.5 inline-block! h-[calc(1lh+0.25rem)] w-2 align-top! stroke-(--border-strong)"
                        fill="none"
                    >
                        <path d="M0 0 L8 12 L0 24" vectorEffect="non-scaling-stroke" />
                    </svg>
                </Fragment>
            ))}
        </span>
    );
}
