import { $ } from 'bun';
import { compileReactDist, describeReactCompilerReport } from '../../../scripts/react-compiler.ts';
import { copyFile, rm } from 'node:fs/promises';

/*
 * One JavaScript file and one declaration file per source file, so a bundler shakes the barrel down
 * to what an app imports. The theme is plain CSS and goes into `dist` as it is.
 */
await rm('dist', { recursive: true, force: true });

await $`tsc -p tsconfig.build.json`;
console.log(describeReactCompilerReport('ui', await compileReactDist('dist')));
await copyFile('src/theme.css', 'dist/theme.css');
