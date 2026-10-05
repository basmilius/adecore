import { createFileTreeIconResolver, type FileTreeIconConfig } from '@pierre/trees';
import { SETI_BY_FILE_EXTENSION, SETI_BY_FILE_NAME, SETI_BY_FILE_NAME_CONTAINS, SETI_DEFAULT_SYMBOL, SETI_SPRITE_SHEET } from './seti-icons.ts';

const SPRITE_ELEMENT_ID = 'adecore-ui-file-icon-sprite';

/* The glyphs are Seti's (`seti-icons.ts`), which knows far more file types than the sets the tree
   ships with. The tree only colors its own sets, so every symbol carries its hue in its id and the
   sprite brings the rules that color it. A tree takes all of it as configuration where everything
   drawn beside it calls `fileIconFor`, so a tab, a picker row and a tree row never disagree about
   what a file is. Hand this to the tree. */
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
 * document. The path may be absolute or relative. Only the last segment decides, first by exact
 * name (`package.json`, `.gitignore`), then by a part of the name (`Dockerfile.dev`), then by the
 * longest extension that matches (`spec.ts` before `ts`). Anything the set does not know falls back
 * to its generic file icon, and so does a directory. The tree marks a folder with the chevron that
 * turns as it opens, not with a glyph of its own.
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
