import { Fragment, type ComponentType } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from '@adecore/ui';
import type { ReferenceIconProps } from '../../host';
import type { ReferenceStep } from '../chat-references';
import { referenceGlyph } from './reference-icons';

interface ReferenceTrailProps {
    trail: readonly ReferenceStep[];
    hostIcon: ComponentType<ReferenceIconProps> | null | undefined;
    size: number;
    iconClassName?: string;
}

/* Where a reference stands, in front of its own mark. Each place may shorten, so the name it leads to stays whole. */
export function ReferenceTrail({ trail, hostIcon, size, iconClassName }: ReferenceTrailProps) {
    return (
        <span className="font-normal text-text-muted">
            {trail.map((step) => (
                <Fragment key={step.id}>
                    {referenceGlyph(hostIcon, { id: step.id, kind: step.kind, size, className: iconClassName })}
                    <span className="inline-block max-w-40 truncate align-bottom">{step.name}</span>
                    <Icon icon={ChevronRight} size={12} className="mx-0.5 inline align-[calc(0.5cap-6px)]!" />
                </Fragment>
            ))}
        </span>
    );
}
