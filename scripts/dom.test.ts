import { Glob } from 'bun';
import { expect, test } from 'bun:test';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/*
 * Base UI and React DOM read `document` once, as they load, so a DOM has to stand before the first
 * import, and the rest of the suite must never see one (the boundary and import-time tests). Every
 * `*.dom.test.ts(x)` file is therefore left out of the default run (`bunfig.toml`) and runs here, in a
 * `bun test` of its own with the DOM preload (`dom.bunfig.toml`). To run one by hand: `bun --config=dom.bunfig.toml test <file>`.
 */
const files = ['packages/*/src/**/*.dom.test.{ts,tsx}', 'docs/**/*.dom.test.{ts,tsx}']
    .flatMap((pattern) => [...new Glob(pattern).scanSync(ROOT)])
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => !path.includes('node_modules/'))
    .sort();

const running: Promise<unknown>[] = [];
const slots = Math.max(2, availableParallelism());

async function inSlot<T>(run: () => Promise<T>): Promise<T> {
    while (running.length >= slots) {
        await Promise.race(running);
    }
    const job = run();
    const tracked = job.finally(() => running.splice(running.indexOf(tracked), 1));
    running.push(tracked);
    return job;
}

test('finds the DOM tests', () => {
    expect(files.length).toBeGreaterThan(0);
});

test.concurrent.each(files)(
    '%s in a DOM',
    async (file) => {
        const output = await inSlot(async () => {
            const child = Bun.spawn([process.execPath, '--config=dom.bunfig.toml', 'test', `./${file}`], {
                cwd: ROOT,
                stdin: 'ignore',
                stdout: 'pipe',
                stderr: 'pipe'
            });
            const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
            return { code, log: `${stderr}\n${stdout}` };
        });
        if (output.code !== 0) {
            throw new Error(`${file} failed:\n${output.log}`.slice(0, 20_000));
        }
        // A test that still skips here saw no DOM: the preload came too late.
        expect(output.log).not.toMatch(/^\s*[1-9]\d* skip$/m);
    },
    120_000
);
