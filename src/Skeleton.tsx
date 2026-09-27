import type { Ref } from 'react';
import clsx from 'clsx';

export interface SkeletonProps {
    /* The width, and a height other than the one line of 16px. */
    className?: string;
    ref?: Ref<HTMLSpanElement>;
}

/* A bar where a value will be, while the answer is still on its way. */
export function Skeleton({ className, ref }: SkeletonProps) {
    return <span ref={ref} className={clsx('block h-4 animate-pulse rounded bg-surface-sunken', className)} aria-hidden />;
}
