import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const folder = mkdtempSync(join(tmpdir(), 'tee-cli-'));
const recorder = join(import.meta.dir, 'tee-cli.ts');
const fakeCodex = join(import.meta.dir, '../src/testing/bin/fake-codex.ts');

afterAll(() => {
    rmSync(folder, { recursive: true, force: true });
});

test('records a CLI behind real pipes and exits with its code', async () => {
    const out = join(folder, 'codex.ndjson');
    const request = '{"id":1,"method":"initialize","params":{}}\n';

    const child = Bun.spawn({
        cmd: [process.execPath, recorder, out, '--', process.execPath, fakeCodex],
        cwd: folder,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe'
    });

    child.stdin.write(request);
    child.stdin.end();
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    const records = readFileSync(out, 'utf8')
        .trimEnd()
        .split('\n')
        .map((line) => JSON.parse(line));

    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({ id: 1, result: { userAgent: 'fake-codex/0.0.0' } });
    expect(records.map((record) => [record.type, record.dir ?? null, record.line ?? null])).toEqual([
        ['start', null, null],
        ['line', 'in', request.trimEnd()],
        ['line', 'out', stdout.trimEnd()],
        ['exit', null, null]
    ]);
    expect(records.at(-1)).toMatchObject({ code: 0, signal: null });
    expect(statSync(out).mode & 0o777).toBe(0o600);
});
