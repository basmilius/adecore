import clsx from 'clsx';
import { useInsertionEffect, useSyncExternalStore, type Ref } from 'react';
import { fileIconFor, fileIconOverrideFor, fileIconOverrideVersion, mountFileIconSprite, subscribeFileIconOverride } from './file-icon.ts';

export interface FileIconProps {
    /* Absolute or relative; only the last segment decides which icon this is. */
    path: string;

    size?: number;
    className?: string;

    /* An `<img>` when an override gives the file an icon of the app's own, the `<svg>` otherwise. */
    ref?: Ref<SVGSVGElement | HTMLImageElement>;
}

/*
 * The one place the library steps outside Lucide. The glyphs are Seti's, and so are their colors: a
 * TypeScript blue is the mark of the file type, not a theme choice. Decorative like every other icon here.
 */
export function FileIcon({ path, size = 16, className, ref }: FileIconProps) {
    // Before the browser paints, so a `<use>` never points at a symbol that is not in the document yet.
    useInsertionEffect(mountFileIconSprite, []);

    const version = useSyncExternalStore(subscribeFileIconOverride, fileIconOverrideVersion, fileIconOverrideVersion);
    const own = overrideFor(path, version);

    // React types a readonly ref object, so the union passes to neither element without a cast; each holds one of its members.
    if (own !== null) {
        return <img ref={ref as Ref<HTMLImageElement>} src={own} alt="" width={size} height={size} className={clsx('file-icon', className)} />;
    }

    return (
        <svg ref={ref as Ref<SVGSVGElement>} className={clsx('file-icon', className)} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
            <use href={`#${fileIconFor(path)}`} />
        </svg>
    );
}

/* Takes the version so the compiler caches the result on it as well as on the path. */
function overrideFor(path: string, _version: number): string | null {
    return fileIconOverrideFor(path);
}
