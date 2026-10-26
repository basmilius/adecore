import type { RenderOptions } from 'pele';

/* The variable of Pele each token of the theme fills. Borders carry an alpha, so every color is resolved over the ground. */
export const DIAGRAM_TOKENS: Readonly<Record<string, string>> = {
    '--pele-bg': '--chat-code-bg',
    '--pele-fg': '--text',
    '--pele-muted': '--text-muted',
    '--pele-line': '--text-muted',
    '--pele-surface': '--surface-raised',
    '--pele-surface-alt': '--surface',
    '--pele-border': '--border-strong',
    '--pele-accent': '--accent',
    '--pele-critical': '--status-error',
    '--pele-series-1': '--accent',
    '--pele-series-2': '--chart-2',
    '--pele-series-3': '--chart-3',
    '--pele-series-4': '--chart-4',
    '--pele-series-5': '--chart-5',
    '--pele-series-6': '--chart-6'
};

export const GROUND_TOKEN = DIAGRAM_TOKENS['--pele-bg']!;

export interface DiagramFont {
    family: string;
    mono: string;
    size: number;
}

/*
 * At the size it was laid out at, since an image has no container to shrink to. No links and no images, and no
 * math or icon resolver, which are the only markup Pele inserts unfiltered. What comes out is drawn as an image as
 * well, which never runs script and loads nothing, whatever the text of the diagram says.
 */
export function renderOptions(font: DiagramFont, idPrefix: string): RenderOptions {
    return {
        responsive: false,
        idPrefix,
        fontFamily: font.family,
        fontFamilyMono: font.mono,
        fontSize: font.size,
        links: false,
        images: false
    };
}

const ROOT = /<svg\b[^>]*>/;
const STYLE = /\sstyle="/;

function attributeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/*
 * The drawing with the colors set on its root. An image does not see the variables of the page, so they are
 * written in, and a change of the theme only writes them again.
 */
export function themedSvg(svg: string, colors: Readonly<Record<string, string>>): string {
    const root = ROOT.exec(svg);

    if (root === null) {
        return svg;
    }

    const variables = attributeText(
        Object.entries(colors)
            .map(([name, value]) => `${name}:${value};`)
            .join('')
    );

    const tag = STYLE.test(root[0]) ? root[0].replace(STYLE, (style) => style + variables) : root[0].replace(/^<svg\b/, `<svg style="${variables}"`);

    return svg.slice(0, root.index) + tag + svg.slice(root.index + root[0].length);
}

export function svgDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
