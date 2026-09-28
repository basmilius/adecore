import type { ComponentProps, CSSProperties } from 'react';
import clsx from 'clsx';

const DOTS = [0, 1, 2];

export interface SpinnerProps extends Omit<ComponentProps<'span'>, 'children'> {
    /* In pixels, on the steps of an icon: 12, 14, 16 or 20. */
    size?: number;
    /* What runs, read by a screen reader. Left out where the words beside it already say so, which hides the spinner as an icon is hidden. */
    label?: string;
}

/* Work in progress: three dots that leap over each other in the color of the text around them. With reduced motion they stand still. */
export function Spinner({ size = 16, label, className, style, ref, ...props }: SpinnerProps) {
    return (
        <span
            ref={ref}
            role={label === undefined ? undefined : 'img'}
            aria-label={label}
            aria-hidden={label === undefined ? true : undefined}
            {...props}
            className={clsx('spinner', className)}
            style={{ ...style, '--spinner-size': `${size}px` } as CSSProperties}
        >
            {DOTS.map((dot) => (
                <span key={dot} className="spinner-hop" style={{ '--spinner-step': dot } as CSSProperties}>
                    <span className="spinner-dot" />
                </span>
            ))}
        </span>
    );
}
