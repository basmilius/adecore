import clsx from 'clsx';
import { useState, type ComponentProps } from 'react';
import { initialsOf } from './initials.ts';

const SIZE = {
    sm: 'size-6 text-2xs',
    md: 'size-9 text-xs',
    lg: 'size-12 text-base'
} as const;

export interface AvatarProps extends Omit<ComponentProps<'span'>, 'children'> {
    /* The initials come from it, and it is what a screen reader reads. */
    name: string;

    /* A picture; the initials show while it loads and when it fails. */
    src?: string;

    /* 24, 36 or 48 pixels. */
    size?: keyof typeof SIZE;
}

/* A person in a circle: their initials on a neutral ground, or their picture. Next to the name it repeats, pass `aria-hidden`. */
export function Avatar({ name, src, size = 'md', className, ref, ...props }: AvatarProps) {
    const [loaded, setLoaded] = useState<string | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const picture = src !== undefined && failed !== src ? src : undefined;
    const shown = picture !== undefined && loaded === picture;

    return (
        <span
            ref={ref}
            role="img"
            aria-label={name}
            {...props}
            className={clsx(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-text/14 font-medium text-text-muted select-none',
                SIZE[size],
                className
            )}
        >
            <span aria-hidden className={clsx(shown && 'invisible')}>
                {initialsOf(name)}
            </span>
            {picture !== undefined && (
                <img
                    src={picture}
                    alt=""
                    className={clsx('absolute inset-0 size-full object-cover', !shown && 'opacity-0')}
                    onLoad={() => setLoaded(picture)}
                    onError={() => setFailed(picture)}
                />
            )}
        </span>
    );
}
