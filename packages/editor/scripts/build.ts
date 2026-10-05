import { $ } from 'bun';
import { copyFile, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await $`tsc -p tsconfig.build.json`;
await copyFile('src/editor.css', 'dist/editor.css');
