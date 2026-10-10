import { createFileTreeIconResolver, type FileTreeIconConfig } from '@pierre/trees';
import { SETI_BY_FILE_EXTENSION, SETI_BY_FILE_NAME, SETI_BY_FILE_NAME_CONTAINS, SETI_DEFAULT_SYMBOL, SETI_SPRITE_SHEET } from './seti-icons.ts';

const SPRITE_ELEMENT_ID = 'adecore-ui-file-icon-sprite';

/* Hand this to the tree. The glyphs are Seti's (`seti-icons.ts`), which knows far more file types than
   the tree's own sets. The tree colors only those, so every symbol carries its hue in its id and the
   sprite brings the rules that color it. Everything drawn beside a tree calls `fileIconFor`, so a tab,
   a picker row and a tree row never disagree about what a file is. */
export const FILE_TREE_ICONS: FileTreeIconConfig = {
    set: 'none',
    spriteSheet: SETI_SPRITE_SHEET,
    remap: { 'file-tree-icon-file': SETI_DEFAULT_SYMBOL },
    byFileName: SETI_BY_FILE_NAME,
    byFileExtension: SETI_BY_FILE_EXTENSION,
    byFileNameContains: SETI_BY_FILE_NAME_CONTAINS
};

let resolver: ReturnType<typeof createFileTreeIconResolver> | null = null;

/* Built on the first icon rather than on import, so a bundle that never draws one never builds it. */
const resolveIcon: ReturnType<typeof createFileTreeIconResolver>['resolveIcon'] = (...args) => {
    resolver ??= createFileTreeIconResolver(FILE_TREE_ICONS);
    return resolver.resolveIcon(...args);
};

/*
 * The id of the `<symbol>` the set gives a file, in the sprite `mountFileIconSprite` puts in the
 * document. Only the last segment of the path decides, first by exact name (`package.json`), then by
 * a part of the name (`Dockerfile.dev`), then by the longest extension that matches (`spec.ts` before
 * `ts`). Anything else falls back to the generic file icon, a directory included: the tree marks a
 * folder with its chevron, not a glyph.
 */
export const fileIconFor = (path: string): string => resolveIcon('file-tree-icon-file', path).name;

/* The tree carries the sprite into its own shadow root, out of reach of anything that draws an
   icon next to it, so the document gets a copy of the same sheet to point `<use>` at. */
export const mountFileIconSprite = (): void => {
    if (document.getElementById(SPRITE_ELEMENT_ID) !== null) {
        return;
    }
    const holder = document.createElement('div');
    holder.innerHTML = SETI_SPRITE_SHEET;
    const sprite = holder.firstElementChild;
    if (sprite === null) {
        return;
    }
    sprite.id = SPRITE_ELEMENT_ID;
    (document.body ?? document.documentElement).append(sprite);
};
