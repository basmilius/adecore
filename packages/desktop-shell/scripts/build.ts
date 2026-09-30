import { $ } from 'bun';
import { rm } from 'node:fs/promises';

/* One JavaScript file and one declaration file per source file, so a bundler takes only what an app imports. */
await rm('dist', { recursive: true, force: true });
await $`tsc -p tsconfig.build.json`;
