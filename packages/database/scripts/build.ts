import { $ } from 'bun';
import { rm } from 'node:fs/promises';

/* One JavaScript file and one declaration file per source file. The helper is built by cargo and ships apart from this package. */
await rm('dist', { recursive: true, force: true });
await $`tsc -p tsconfig.build.json`;
