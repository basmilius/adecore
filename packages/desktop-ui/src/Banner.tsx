import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon.tsx';
import { Surface } from './Surface.tsx';

/* The mark in front of the line: a decision to make, a failure to read, or something that happened. */
export type BannerTone = 'attention' | 'error' | 'neutral';

const TONE: Record<BannerTone, string> = {
    attention: 'text-status-needs-you',
    error: 'text-status-error',
    neutral: 'text-text-muted'
};

export interface BannerProps {
    icon: LucideIcon;
    tone: BannerTone;
    message: ReactNode;
    /* The buttons that answer the line. */
    children?: ReactNode;
    /* Where the strip stands; by default centered along the top of the positioned parent. */
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/*
 * The strip over a view: one line and the buttons that answer it. It is where anything that waits
 * for a person goes (a conflict, a failure, a request), because a corner toast is read after the fact
 * and a decision has to be where the eyes already are. One at a time: the slot is one row and the
 * caller picks what stands in it.
 */
export function Banner({ icon, tone, message, children, className = 'absolute inset-x-0 top-3 z-20', ref }: BannerProps) {
    return (
        <div ref={ref} className={clsx('pointer-events-auto flex justify-center px-4', className)} role="status" aria-live="polite">
            <Surface className="flex max-w-[640px] items-center gap-3 rounded-lg px-3 py-2 text-sm text-text">
                <Icon icon={icon} size={16} className={clsx('shrink-0', TONE[tone])} />
                <span className="grow">{message}</span>
                {children}
            </Surface>
        </div>
    );
}
