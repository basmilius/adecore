import { DEFAULT_PALETTE } from '@adecore/drawing';
import { DRAWING_COLORS, type DrawingColor } from '@adecore/drawing/protocol';

/* The palette names in the tokens of this site. The SVG sits inline in the page, so a variable resolves; a file saved to disk needs plain colors. */
export const THEME_PALETTE: Record<DrawingColor, string> = {
    ...DEFAULT_PALETTE,
    ink: 'var(--text)',
    muted: 'var(--text-muted)',
    accent: 'var(--accent)'
};

function mixed(share: number): Record<DrawingColor, string> {
    return Object.fromEntries(DRAWING_COLORS.map((color) => [color, `color-mix(in srgb, ${THEME_PALETTE[color]} ${share}%, var(--surface))`])) as Record<
        DrawingColor,
        string
    >;
}

export const THEME_PAPER = mixed(18);
export const THEME_EDGE = mixed(40);
