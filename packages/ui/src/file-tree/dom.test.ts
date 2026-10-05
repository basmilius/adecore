import { expect, test } from 'bun:test';

// React and Base UI must first load with a DOM; isolate this process from the server-rendered suite.
test('file tree interactions in a DOM', () => {
    const result = Bun.spawnSync([process.execPath, 'test', '--preload', './testing/preload.ts', './interaction.test.tsx'], {
        cwd: new URL('.', import.meta.url).pathname,
        env: process.env
    });
    if (result.exitCode !== 0) {
        console.error(new TextDecoder().decode(result.stderr));
    }
    expect(result.exitCode).toBe(0);
});
