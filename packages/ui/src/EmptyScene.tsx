import clsx from 'clsx';
import { useId, type CSSProperties, type ReactNode } from 'react';

export interface EmptySceneProps {
    /* For a panel: 136 by 88 pixels instead of 160 by 104. */
    compact?: boolean;

    /* SVG in a 160 by 104 view box, drawn with the `scene-*` classes of the theme. */
    children: ReactNode;

    className?: string;
}

/* The drawing an `EmptyState` shows through `scene`. It only decorates, so it stays out of the accessibility tree. */
export function EmptyScene({ compact = false, children, className }: EmptySceneProps) {
    const gradient = useId();
    const style = { '--scene-fill': `url("#${gradient}")` } as CSSProperties;

    return (
        <svg className={clsx('scene', compact && 'scene-compact', className)} viewBox="0 0 160 104" style={style} aria-hidden="true">
            <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: 'var(--scene-top)' }} />
                    <stop offset="1" style={{ stopColor: 'var(--scene-bottom)' }} />
                </linearGradient>
            </defs>
            {children}
        </svg>
    );
}
