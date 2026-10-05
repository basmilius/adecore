import { $ } from 'bun';
import opentype from 'opentype.js';

/*
 * Writes `src/seti-icons.ts` from Seti UI, the set VS Code ships as its default file icon theme. The
 * glyphs come from its font rather than its SVGs, because the font is what VS Code draws: one shape
 * per type, where several SVGs carry gradients and second colors. The rules and their hues come
 * from `mapping.less`. Run with `bun scripts/generate-seti-icons.ts` after moving `COMMIT`.
 */
const COMMIT = '2d6c5e68b4ded73c92dac291845ee44e1182d511';
const SOURCE = `https://raw.githubusercontent.com/jesseweed/seti-ui/${COMMIT}`;
const OUTPUT = new URL('../src/seti-icons.ts', import.meta.url);
const OXFMT = new URL('../../../node_modules/.bin/oxfmt', import.meta.url);

/* The smallest square a glyph is centered in, in font units. It sets how large a typical glyph
   draws in its box; a glyph larger than this gets a square of its own size, so nothing is cut off. */
const MIN_BOX = 720;

/* Seti's colors onto the theme's `--file-icon-*` tokens. `white` is its color for plain text, which
   the library draws in the muted text color like any icon without a hue. */
const HUE_BY_COLOR: Record<string, string | null> = {
    blue: 'blue',
    'seti-primary': 'blue',
    green: 'green',
    grey: 'gray',
    'grey-light': 'gray',
    ignore: 'gray',
    orange: 'orange',
    pink: 'pink',
    purple: 'purple',
    red: 'red',
    yellow: 'yellow',
    white: null
};

const DEFAULT_GLYPH = 'default';

type Rule = { kind: 'set' | 'partial'; match: string; glyph: string; hue: string | null };

const fetchSource = async (path: string): Promise<Response> => {
    const response = await fetch(`${SOURCE}/${path}`);
    if (!response.ok) {
        throw new Error(`${path}: ${response.status} ${response.statusText}`);
    }
    return response;
};

const parseRules = (less: string): Rule[] => {
    const rules: Rule[] = [];
    for (const [, kind, match, glyph, color] of less.matchAll(/\.icon-(set|partial)\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*@([a-z-]+)\s*\)/g)) {
        if (!(color in HUE_BY_COLOR)) {
            throw new Error(`Unknown Seti color @${color} for ${match}.`);
        }
        rules.push({ kind: kind as Rule['kind'], match, glyph, hue: HUE_BY_COLOR[color] });
    }
    return rules;
};

const symbolId = (glyph: string, hue: string | null): string => `seti-${hue ?? 'plain'}-${glyph}`;

const glyphSymbol = (font: opentype.Font, codePoints: Map<string, string>, name: string): string => {
    const character = codePoints.get(name);
    if (character === undefined) {
        throw new Error(`Seti has no code point for the glyph ${name}.`);
    }
    const glyph = font.charToGlyph(character);
    const box = glyph.getBoundingBox();
    const size = Math.ceil(Math.max(MIN_BOX, box.x2 - box.x1, box.y2 - box.y1));
    const centerX = (box.x1 + box.x2) / 2;
    // Font units point up and SVG units down, so the path is drawn upside down around the baseline.
    const centerY = -(box.y1 + box.y2) / 2;
    const viewBox = [Math.round(centerX - size / 2), Math.round(centerY - size / 2), size, size].join(' ');
    const path = glyph.getPath(0, 0, font.unitsPerEm).toPathData(0);
    return `<symbol id="seti-glyph-${name}" viewBox="${viewBox}"><path fill="currentColor" d="${path}"/></symbol>`;
};

/* The font names its glyphs loosely, so a glyph is found the way Seti's own CSS finds it: by the
   code point `seti.less` gives its name. */
const parseCodePoints = (less: string): Map<string, string> => {
    const codePoints = new Map<string, string>();
    for (const [, name, hex] of less.matchAll(/@([A-Za-z0-9_-]+):\s*'\\([0-9A-Fa-f]+)'/g)) {
        codePoints.set(name, String.fromCodePoint(Number.parseInt(hex, 16)));
    }
    return codePoints;
};

const [less, fontLess, woff, license] = await Promise.all([
    fetchSource('styles/components/icons/mapping.less').then((response) => response.text()),
    fetchSource('styles/_fonts/seti.less').then((response) => response.text()),
    fetchSource('styles/_fonts/seti/seti.woff').then((response) => response.arrayBuffer()),
    fetchSource('LICENSE.md').then((response) => response.text())
]);

const font = opentype.parse(woff);
const rules = parseRules(less);
const codePoints = parseCodePoints(fontLess);

const byFileName: Record<string, string> = {};
const byFileExtension: Record<string, string> = {};
const byFileNameContains: Record<string, string> = {};
const pairs = new Map<string, { glyph: string; hue: string | null }>([[symbolId(DEFAULT_GLYPH, null), { glyph: DEFAULT_GLYPH, hue: null }]]);

/* In Seti a later rule wins over an earlier one, since they are CSS rules of equal weight. A rule
   that starts with a dot matches the end of a name, so it is an extension, and the tree matches a
   dotfile (`.gitignore`) by the extension it reads from it too. A rule for a glyph the font was
   not built with yet is left out, so the name falls through to a rule further down the line. */
const skipped = new Set<string>();
for (const rule of rules) {
    if (!codePoints.has(rule.glyph)) {
        skipped.add(rule.glyph);
        continue;
    }
    const id = symbolId(rule.glyph, rule.hue);
    pairs.set(id, { glyph: rule.glyph, hue: rule.hue });
    if (rule.kind === 'partial') {
        byFileNameContains[rule.match.toLowerCase()] = id;
    } else if (rule.match.startsWith('.')) {
        byFileExtension[rule.match.slice(1).toLowerCase()] = id;
    } else {
        byFileName[rule.match.toLowerCase()] = id;
    }
}

const glyphs = [...new Set([...pairs.values()].map((pair) => pair.glyph))].sort();
const hues = [...new Set([...pairs.values()].map((pair) => pair.hue).filter((hue) => hue !== null))].sort();

/* A pair of glyph and hue is a symbol of its own, so the hue rides on the id the tree puts in its
   `href` and the sprite colors it without the tree's help. The `<style>` travels with the sprite
   into the tree's shadow root, where no stylesheet of the page reaches. */
const sprite = [
    '<svg data-icon-sprite aria-hidden="true" width="0" height="0">',
    `<style>${hues.map((hue) => `use[href^="#seti-${hue}-"]{color:var(--file-icon-${hue})}`).join('')}</style>`,
    ...glyphs.map((glyph) => glyphSymbol(font, codePoints, glyph)),
    ...[...pairs].map(([id, pair]) => `<symbol id="${id}" viewBox="0 0 16 16"><use href="#seti-glyph-${pair.glyph}"/></symbol>`),
    '</svg>'
].join('');

const sortedRecord = (record: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

const source = `/*
 * Generated by \`scripts/generate-seti-icons.ts\` from Seti UI (https://github.com/jesseweed/seti-ui,
 * commit ${COMMIT}). Do not edit; change the script and run it again.
 *
${license
    .trim()
    .split('\n')
    .map((line) => ` * ${line}`.trimEnd())
    .join('\n')}
 */

export const SETI_DEFAULT_SYMBOL = ${JSON.stringify(symbolId(DEFAULT_GLYPH, null))};

export const SETI_BY_FILE_NAME: Record<string, string> = ${JSON.stringify(sortedRecord(byFileName))};

export const SETI_BY_FILE_EXTENSION: Record<string, string> = ${JSON.stringify(sortedRecord(byFileExtension))};

export const SETI_BY_FILE_NAME_CONTAINS: Record<string, string> = ${JSON.stringify(sortedRecord(byFileNameContains))};

export const SETI_SPRITE_SHEET = ${JSON.stringify(sprite)};
`;

await Bun.write(OUTPUT, source);
await $`${OXFMT.pathname} --write ${OUTPUT.pathname}`;
if (skipped.size > 0) {
    console.warn(`Not in the font, rules left out: ${[...skipped].join(', ')}.`);
}
console.log(`${rules.length} rules, ${glyphs.length} glyphs, ${pairs.size} symbols.`);
