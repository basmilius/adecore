/* Reads the tokens out of the library's `theme.css`, so the theme page lists what the file holds rather than a copy. */

export type TokenKind = 'color' | 'channels' | 'shadow' | 'value';

export interface ThemeToken {
    name: string;
    group: string;
    kind: TokenKind;
    light: string;
    /* Null where the dark theme keeps the light value, or resolves the same expression against its own tokens. */
    dark: string | null;
    /* The Tailwind utility suffix the theme maps onto this token, such as `surface-raised` for `bg-surface-raised`. */
    utility: string | null;
}

export interface ScaleToken {
    name: string;
    group: string;
    value: string;
    /* Only a text size carries one. */
    lineHeight: string | null;
}

export interface ThemeTokens {
    tokens: ThemeToken[];
    scale: ScaleToken[];
}

interface Block {
    prelude: string;
    body: string;
}

/* The blocks at the top level of the file, with what is nested in them left as their body. */
function blocksOf(css: string): Block[] {
    const blocks: Block[] = [];
    let depth = 0;
    let start = 0;
    let open = 0;
    for (let i = 0; i < css.length; i++) {
        const char = css[i];
        if (char === '{') {
            if (depth === 0) {
                open = i;
            }
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                blocks.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
                start = i + 1;
            }
        } else if (char === ';' && depth === 0) {
            start = i + 1;
        }
    }
    return blocks;
}

function declarationsOf(body: string): [string, string][] {
    return body
        .split(';')
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration.startsWith('--'))
        .map((declaration) => {
            const colon = declaration.indexOf(':');
            return [
                declaration.slice(2, colon).trim(),
                declaration
                    .slice(colon + 1)
                    .replace(/\s+/g, ' ')
                    .trim()
            ];
        });
}

const GROUPS: [string, RegExp][] = [
    ['ground', /^(bg|surface.*)$/],
    ['border', /^(border.*|separator)$/],
    ['text', /^text/],
    ['accent', /^(accent.*|selection)$/],
    ['status', /^(status-.*|positive.*)$/],
    ['media', /^media-/],
    ['shadow', /-shadow$/],
    ['file-icon', /^file-icon-/],
    ['layer', /^z-/],
    ['code', /^code-/]
];

const SCALE_GROUPS: [string, RegExp][] = [
    ['type', /^text-/],
    ['radius', /^radius-/],
    ['font', /^font-/],
    ['leading', /^leading-/],
    ['spacing', /^spacing$/]
];

const LINE_HEIGHT = '--line-height';

function groupOf(name: string, groups: [string, RegExp][]): string {
    return groups.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other';
}

function kindOf(value: string): TokenKind {
    if (/^\d+ \d+ \d+$/.test(value)) {
        return 'channels';
    }
    if (/^-?\d/.test(value) && value.includes('px')) {
        return 'shadow';
    }
    return /^(#|rgb|hsl|oklch|color-mix)/.test(value) ? 'color' : 'value';
}

/*
 * Splits an `@theme` block into the utilities it maps onto a theme token (`--color-surface: var(--surface)`)
 * and the scale it defines itself, each text size with its line height.
 */
function readThemeBlock(declarations: [string, string][], utilities: Map<string, string>, scale: ScaleToken[]): void {
    for (const [name, value] of declarations) {
        const mapped = /^var\(--([\w-]+)\)$/.exec(value);
        const utility = /^(?:color|shadow)-([\w-]+)$/.exec(name);
        if (mapped !== null && utility !== null) {
            utilities.set(mapped[1]!, utility[1]!);
        } else if (!name.endsWith(LINE_HEIGHT) && !name.endsWith('*')) {
            scale.push({ name, group: groupOf(name, SCALE_GROUPS), value, lineHeight: null });
        }
    }
    for (const [name, value] of declarations.filter(([name]) => name.endsWith(LINE_HEIGHT))) {
        const size = scale.find((entry) => entry.name === name.slice(0, -LINE_HEIGHT.length));
        if (size !== undefined) {
            size.lineHeight = value;
        }
    }
}

export function readThemeTokens(css: string): ThemeTokens {
    const blocks = blocksOf(css.replace(/\/\*[\s\S]*?\*\//g, ''));
    const light = new Map<string, string>();
    const dark = new Map<string, string>();
    const layers = new Map<string, string>();
    const utilities = new Map<string, string>();
    const scale: ScaleToken[] = [];

    for (const { prelude, body } of blocks) {
        const declarations = declarationsOf(body);
        if (prelude.includes('[data-theme="light"]')) {
            declarations.forEach(([name, value]) => light.set(name, value));
        } else if (prelude.includes('[data-theme="dark"]')) {
            declarations.forEach(([name, value]) => dark.set(name, value));
        } else if (prelude === ':root') {
            declarations.forEach(([name, value]) => layers.set(name, value));
        } else if (prelude.startsWith('@theme')) {
            readThemeBlock(declarations, utilities, scale);
        }
    }

    const themed = [...light].map(([name, value]): ThemeToken => ({
        name,
        group: groupOf(name, GROUPS),
        kind: kindOf(value),
        light: value,
        dark: dark.get(name) ?? null,
        utility: utilities.get(name) ?? null
    }));
    const layered = [...layers].map(([name, value]): ThemeToken => ({
        name,
        group: groupOf(name, GROUPS),
        kind: 'value',
        light: value,
        dark: null,
        utility: null
    }));
    return { tokens: [...themed, ...layered], scale };
}
