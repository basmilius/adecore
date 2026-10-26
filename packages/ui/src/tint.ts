import type { CSSProperties } from 'react';

/*
 * The custom properties that let what stands on a colored ground follow its color: the hover of a
 * button and a separator. The theme's utilities read `--surface-hover` and `--border` themselves
 * (`@theme inline`), so a host sets this on the colored element and its buttons and separators
 * take it. `--border` is mixed from `--border-strong`, since a property that reads itself is no
 * value at all.
 */
export function tintStyle(color: string, ground = 'var(--surface-raised)'): CSSProperties {
    return {
        '--surface-hover': `color-mix(in srgb, ${color} 34%, ${ground})`,
        '--border': `color-mix(in srgb, ${color} 35%, var(--border-strong))`
    } as CSSProperties;
}
