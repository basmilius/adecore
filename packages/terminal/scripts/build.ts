import { $ } from 'bun';
import { copyFile, rm } from 'node:fs/promises';
import { compileReactDist, describeReactCompilerReport } from '../../../scripts/react-compiler.ts';

/* One JavaScript file and one declaration file per source file. The stylesheet is plain CSS and goes into `dist` as it is. */
await rm('dist', { recursive: true, force: true });
await $`tsc -p tsconfig.build.json`;
console.log(describeReactCompilerReport('terminal', await compileReactDist('dist')));
await copyFile('src/terminal.css', 'dist/terminal.css');
