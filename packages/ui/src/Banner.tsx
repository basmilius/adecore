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

const OVERLAY = 'absolute inset-x-0 top-3 z-20';

export interface BannerProps {
    icon: LucideIcon;
    tone: BannerTone;
    message: ReactNode;

    /* The buttons that answer the line. */
    children?: ReactNode;

    /* Under `overlay` a `className` replaces the overlay position instead of adding to it, so its utilities never meet the component's own. */
    placement?: 'overlay' | 'inline';

    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* Where anything that waits for a person goes: a corner toast is read after the fact, and a decision has to be where the eyes already are. */
export function Banner({ icon, tone, message, children, placement = 'overlay', className, ref }: BannerProps) {
    const line = (
        <>
            <Icon icon={icon} size={16} className={clsx('shrink-0', TONE[tone])} />
            <span className="grow">{message}</span>
            {children}
        </>
    );

    if (placement === 'inline') {
        return (
            <div
                ref={ref}
                className={clsx('flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text', className)}
                role="status"
                aria-live="polite"
            >
                {line}
            </div>
        );
    }

    return (
        <div ref={ref} className={clsx('pointer-events-auto flex justify-center px-4', className ?? OVERLAY)} role="status" aria-live="polite">
            <Surface className="flex max-w-[640px] items-center gap-3 rounded-lg px-3 py-2 text-sm text-text">{line}</Surface>
        </div>
    );
}
