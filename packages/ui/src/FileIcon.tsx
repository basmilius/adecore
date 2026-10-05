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
 * The icon a file gets in a file tree, drawn anywhere else the same file's name shows up. It is the
 * one place the library steps outside Lucide. The glyphs are Seti's, and so are their colors, because
 * a TypeScript blue or a Vue green is the mark of the file type, not a theme choice. Decorative like
 * every other icon here, so the name beside it does the reading.
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
