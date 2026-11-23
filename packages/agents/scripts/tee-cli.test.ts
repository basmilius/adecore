import { describe, expect, test } from 'bun:test';
import type { FakeCli } from '../src/testing/fake-cli.ts';
import { fakeCodex, inProcess, ManualClock } from '../src/testing/index.ts';
import { parseArguments, tee, type TeeOptions, type TeeRecord } from './tee-cli.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const INITIALIZE = '{"id":1,"method":"initialize","params":{}}';

function recorder(cli: FakeCli, options: Pick<TeeOptions, 'stderr' | 'envNames'>) {
    const clock = new ManualClock();
    const fake = inProcess(cli);
    const records: TeeRecord[] = [];
    const written: string[] = [];
    const errors: string[] = [];
    let push: (chunk: Uint8Array) => void = () => undefined;
    let close: () => void = () => undefined;
    let answered: () => void = () => undefined;

    const answer = new Promise<void>((resolve) => {
        answered = resolve;
    });

    const input = new ReadableStream<Uint8Array>({
        start: (controller) => {
            push = (chunk) => controller.enqueue(chunk);
            close = () => controller.close();
        }
    });

    const exit = tee({
        command: ['codex', 'app-server'],
        cwd: '/work',
        env: { HOME: '/home/someone', OPENAI_API_KEY: 'secret' },
        spawn: fake.spawn,
        input,
        output: (chunk) => {
            written.push(decoder.decode(chunk));
            answered();
        },
        errorOutput: (chunk) => errors.push(decoder.decode(chunk)),
        record: (record) => records.push(record),
        now: () => clock.now(),
        ...options
    });

    return { clock, fake, records, written, errors, push, close, answer, exit };
}

const warns: FakeCli = (io) => ({
    onLine: () => {
        io.err('warning: config at /home/someone\n');
        io.out({ ok: true });
    }
});

describe('tee', () => {
    test('passes both streams through and records every line with its direction and offset', async () => {
        const run = recorder(fakeCodex, { stderr: false, envNames: [] });
        run.clock.advance(5);
        // Split inside the line and inside a two-byte character: the CLI still reads one line.
        const request = `${INITIALIZE.slice(0, -1)},"note":"é"}\n`;
        const bytes = encoder.encode(request);
        const inside = bytes.indexOf(0xc3) + 1;
        run.push(bytes.slice(0, 10));
        run.push(bytes.slice(10, inside));
        run.push(bytes.slice(inside));
        await run.answer;
        run.clock.advance(20);
        run.close();
        const exit = await run.exit;
        const answer = JSON.parse(run.written.join(''));

        expect(answer).toMatchObject({ id: 1, result: { userAgent: 'fake-codex/0.0.0' } });
        expect(run.written.join('').endsWith('\n')).toBe(true);
        expect(exit).toEqual({ code: 0, signal: null });
        expect(run.records).toEqual([
            { type: 'start', t: 0, command: ['codex', 'app-server'] },
            { type: 'line', t: 5, dir: 'in', line: request.trimEnd() },
            { type: 'line', t: 5, dir: 'out', line: run.written.join('').trimEnd() },
            { type: 'exit', t: 25, code: 0, signal: null }
        ]);
    });

    test('keeps stderr and the environment out of the recording unless asked, and only the variables named', async () => {
        for (const asked of [false, true]) {
            const run = recorder(warns, asked ? { stderr: true, envNames: ['HOME'] } : { stderr: false, envNames: [] });
            run.push(encoder.encode(`${INITIALIZE}\n`));
            await run.answer;
            run.fake.started[0]!.crash(3);
            const exit = await run.exit;
            const recorded = JSON.stringify(run.records);

            expect(exit.code).toBe(3);
            expect(run.errors.join('')).toBe('warning: config at /home/someone\n');
            expect(recorded).not.toContain('secret');
            expect(recorded.includes('warning: config')).toBe(asked);
            expect(run.records[0]).toEqual(
                asked
                    ? { type: 'start', t: 0, command: ['codex', 'app-server'], env: { HOME: '/home/someone' } }
                    : { type: 'start', t: 0, command: ['codex', 'app-server'] }
            );
        }
    });
});

describe('parseArguments', () => {
    const outside = (): boolean => false;

    test('reads the file, the options and the command after the separator', () => {
        expect(parseArguments(['/tmp/run.ndjson', '--stderr', '--env', 'PATH', '--', 'claude', '--', '-p'], outside)).toEqual({
            out: '/tmp/run.ndjson',
            command: ['claude', '--', '-p'],
            stderr: true,
            envNames: ['PATH']
        });
    });

    test.each([
        ['no separator', ['/tmp/run.ndjson', 'claude']],
        ['no command', ['/tmp/run.ndjson', '--']],
        ['no file', ['--stderr', '--', 'claude']],
        ['an unknown option', ['/tmp/run.ndjson', '--verbose', '--', 'claude']],
        ['an --env without a name', ['/tmp/run.ndjson', '--env', '--', 'claude']]
    ])('refuses %s', (_, argv) => {
        expect(() => parseArguments(argv, outside)).toThrow();
    });

    test('refuses a file inside a repository and takes one beside it', () => {
        const repository = (path: string): boolean => path === '/code/adecore/.git';

        expect(() => parseArguments(['/code/adecore/captures/run.ndjson', '--', 'agy', 'acp'], repository)).toThrow('/code/adecore');
        expect(parseArguments(['/code/captures/run.ndjson', '--', 'agy', 'acp'], repository).out).toBe('/code/captures/run.ndjson');
    });
});
