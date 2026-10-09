import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

// The block tests need a DOM, which the server-rendered suite must not see, so they run in a process of their own.
test('UI blocks in a DOM', () => {
    const root = fileURLToPath(new URL('../../../../../../', import.meta.url));
    const result = Bun.spawnSync(
        [
            process.execPath,
            'test',
            '--preload',
            './packages/ui/src/file-tree/testing/preload.ts',
            './packages/agents-react/src/chat/ui/intelligent-ui/UiReply.queries.test.ts'
        ],
        { cwd: root, env: process.env }
    );
    if (result.exitCode !== 0) {
        console.error(new TextDecoder().decode(result.stderr));
    }
    expect(new TextDecoder().decode(result.stderr)).not.toContain(' 0 pass');
    expect(result.exitCode).toBe(0);
});
