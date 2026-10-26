import type { CSSProperties } from 'react';

/*
 * The theme's utilities read `--surface-hover` and `--border` themselves (`@theme inline`), so
 * buttons and separators under the element take its color. `--border` mixes from `--border-strong`,
 * since a property that reads itself is no value at all.
 */
export function tintStyle(color: string, ground = 'var(--surface-raised)'): CSSProperties {
    return {
        '--surface-hover': `color-mix(in srgb, ${color} 34%, ${ground})`,
        '--border': `color-mix(in srgb, ${color} 35%, var(--border-strong))`
    } as CSSProperties;
}
