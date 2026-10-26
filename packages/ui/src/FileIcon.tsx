import { useInsertionEffect, type Ref } from 'react';
import clsx from 'clsx';
import { fileIconFor, mountFileIconSprite } from './file-icon.ts';

export interface FileIconProps {
    /* Absolute or relative; only the last segment decides which icon this is. */
    path: string;

    size?: number;
    className?: string;
    ref?: Ref<SVGSVGElement>;
}

/*
 * The one place the library steps outside Lucide. The glyphs are Seti's, and so are their colors: a
 * TypeScript blue is the mark of the file type, not a theme choice. Decorative like every other icon here.
 */
export function FileIcon({ path, size = 16, className, ref }: FileIconProps) {
    // Before the browser paints, so a `<use>` never points at a symbol that is not in the document yet.
    useInsertionEffect(mountFileIconSprite, []);

    return (
        <svg ref={ref} className={clsx('file-icon', className)} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
            <use href={`#${fileIconFor(path)}`} />
        </svg>
    );
}
