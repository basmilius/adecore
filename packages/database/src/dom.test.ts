import { join } from 'node:path';
import { Glob } from 'bun';
import { describe, test } from 'bun:test';

const HERE = new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');
const PRELOAD = join(HERE, 'testing/dom/preload.ts');

const files = [...new Glob('**/*.interaction.test.tsx').scanSync(HERE)].sort();

/*
 * The interaction tests need a DOM from the first import on (see `preload.ts`), which no other test in
 * this process may see. Each file therefore runs in a `bun test` of its own, all at once.
 * To run one by hand: `bun test --preload ./src/testing/dom/preload.ts src/explorer/explorer.interaction.test.tsx`.
 */
describe('the interaction tests, each in a DOM of its own', () => {
    test.concurrent.each(files)(
        '%s',
        async (file) => {
            const child = Bun.spawn([process.execPath, 'test', '--preload', PRELOAD, `./src/${file}`], {
                cwd: ROOT,
                stdout: 'pipe',
                stderr: 'pipe',
                stdin: 'ignore'
            });
            const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
            if (code !== 0) {
                throw new Error(`${file} failed:\n${stderr}\n${stdout}`.slice(0, 20_000));
            }
        },
        60_000
    );
});
