import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { EmptyState } from './EmptyState.tsx';

export interface PanelEmptyProps {
    /* The panel's own header, kept above the sentence so a person can still act while nothing is listed. */
    header?: ReactNode;

    icon?: LucideIcon;

    /* A drawing in place of the icon, usually a compact `EmptyScene`. */
    scene?: ReactNode;

    title?: ReactNode;

    /* A `Spinner` in place of the icon. */
    busy?: boolean;

    action?: ReactNode;

    /* For a box that has no ground behind it yet, such as a card on a canvas. */
    sunken?: boolean;

    /* A panel is one track of a flex column; a card is a box with a height of its own, where `grow` means nothing. */
    fill?: 'grow' | 'full';

    children: ReactNode;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

export function PanelEmpty({ header, icon, scene, title, busy = false, action, sunken = false, fill = 'grow', children, className, ref }: PanelEmptyProps) {
    return (
        <div ref={ref} className={clsx('grid min-h-0 place-items-center', fill === 'full' ? 'h-full' : 'grow', sunken && 'bg-surface-sunken', className)}>
            {header}
            <EmptyState icon={icon} scene={scene} title={title} busy={busy} action={action}>
                {children}
            </EmptyState>
        </div>
    );
}
