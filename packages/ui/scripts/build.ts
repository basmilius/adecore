import { $ } from 'bun';
import { copyFile, rm } from 'node:fs/promises';

/*
 * One JavaScript file and one declaration file per source file, so a bundler shakes the barrel down
 * to what an app imports. The theme is plain CSS and goes into `dist` as it is.
 */
await rm('dist', { recursive: true, force: true });
await $`tsc -p tsconfig.build.json`;
await copyFile('src/theme.css', 'dist/theme.css');
