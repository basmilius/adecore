import { closeSync, existsSync, openSync, writeSync } from 'node:fs';
import { constants } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { ChatProcess, SpawnChatProcess } from '../src/chat-process.ts';

/*
 * Records what an agent CLI says over stdio while a real backend drives it, for the fixtures under
 * `src/chat/fixtures`. It stands in front of the CLI in a provider's command and passes every byte
 * through unchanged; see README.md beside it.
 */

const USAGE = 'bun tee-cli.ts <out.ndjson> [--stderr] [--env NAME]... -- <command> [args]';

export type TeeDirection = 'in' | 'out' | 'err';

export type TeeRecord =
    | { readonly type: 'start'; readonly t: 0; readonly command: readonly string[]; readonly env?: Readonly<Record<string, string>> }
    | { readonly type: 'line'; readonly t: number; readonly dir: TeeDirection; readonly line: string }
    | { readonly type: 'exit'; readonly t: number; readonly code: number | null; readonly signal: string | null };

export interface TeeArguments {
    readonly out: string;
    readonly command: readonly string[];
    readonly stderr: boolean;
    readonly envNames: readonly string[];
}

export interface TeeOptions {
    readonly command: readonly string[];
    readonly cwd: string;
    // What the CLI is started with: the recorder's own environment, untouched.
    readonly env: Readonly<Record<string, string>>;
    readonly spawn: SpawnChatProcess;
    readonly input: AsyncIterable<Uint8Array>;
    output(chunk: Uint8Array): void;
    errorOutput(chunk: Uint8Array): void;
    record(record: TeeRecord): void;
    now(): number;
    // Stderr can carry paths and account names, so it is recorded only when asked.
    readonly stderr: boolean;
    // Only these variables are recorded; the environment holds tokens.
    readonly envNames: readonly string[];
}

export interface TeeExit {
    readonly code: number | null;
    readonly signal: string | null;
}

export function parseArguments(argv: readonly string[], exists: (path: string) => boolean): TeeArguments {
    const separator = argv.indexOf('--');

    if (separator === -1 || separator === argv.length - 1) {
        throw new Error(`No command to record. Usage: ${USAGE}`);
    }

    const [out, ...flags] = argv.slice(0, separator);

    if (out === undefined || out.startsWith('--')) {
        throw new Error(`No file to record into. Usage: ${USAGE}`);
    }

    const repository = repositoryOf(resolve(out), exists);

    if (repository !== null) {
        throw new Error(`${out} is inside the repository ${repository}; raw output stays outside every repository.`);
    }

    let stderr = false;
    const envNames: string[] = [];

    for (let i = 0; i < flags.length; i++) {
        const flag = flags[i];

        if (flag === '--stderr') {
            stderr = true;

            continue;
        }

        const name = flags[i + 1];

        if (flag !== '--env' || name === undefined) {
            throw new Error(`Unknown option ${flag}. Usage: ${USAGE}`);
        }

        envNames.push(name);
        i++;
    }

    return { out, command: argv.slice(separator + 1), stderr, envNames };
}

/* The work tree the path lies in, found by a `.git` entry in one of its folders; a worktree has a `.git` file. */
export function repositoryOf(path: string, exists: (path: string) => boolean): string | null {
    let folder = dirname(path);

    while (true) {
        if (exists(join(folder, '.git'))) {
            return folder;
        }

        const parent = dirname(folder);

        if (parent === folder) {
            return null;
        }

        folder = parent;
    }
}

/* Runs the command between the input and the output and records every line either way; settles once the CLI exited and its output was read. */
export async function tee(options: TeeOptions): Promise<TeeExit> {
    const started = options.now();
    const at = (): number => Math.round(options.now() - started);
    const env = Object.fromEntries(options.envNames.filter((name) => options.env[name] !== undefined).map((name) => [name, options.env[name]!]));
    options.record({ type: 'start', t: 0, command: options.command, ...(options.envNames.length > 0 ? { env } : {}) });

    const recordLines = (dir: TeeDirection, splitter: LineSplitter, chunk: Uint8Array | null): void => {
        for (const line of chunk === null ? splitter.end() : splitter.push(chunk)) {
            options.record({ type: 'line', t: at(), dir, line });
        }
    };

    let settleExit: (exit: TeeExit) => void = () => undefined;

    const exited = new Promise<TeeExit>((resolve) => {
        settleExit = resolve;
    });

    const child = options.spawn({
        command: [...options.command],
        cwd: options.cwd,
        env: { ...options.env },
        onExit: (code, signal) => settleExit({ code, signal: signal ?? null })
    });

    const pump = async (
        stream: ReadableStream<Uint8Array> | undefined,
        dir: TeeDirection,
        forward: (chunk: Uint8Array) => void,
        recorded: boolean
    ): Promise<void> => {
        if (stream === undefined) {
            return;
        }

        const splitter = new LineSplitter();

        for await (const chunk of stream) {
            forward(chunk);

            if (recorded) {
                recordLines(dir, splitter, chunk);
            }
        }

        if (recorded) {
            recordLines(dir, splitter, null);
        }
    };

    // Not awaited: a CLI may exit while the input stays open, and the exit ends the recording.
    void feed(child, options.input, (splitter, chunk) => recordLines('in', splitter, chunk));

    const [exit] = await Promise.all([exited, pump(child.stdout, 'out', options.output, true), pump(child.stderr, 'err', options.errorOutput, options.stderr)]);
    options.record({ type: 'exit', t: at(), code: exit.code, signal: exit.signal });

    return exit;
}

async function feed(child: ChatProcess, input: AsyncIterable<Uint8Array>, record: (splitter: LineSplitter, chunk: Uint8Array | null) => void): Promise<void> {
    const decoder = new TextDecoder();
    const splitter = new LineSplitter();

    for await (const chunk of input) {
        // Before the write: a CLI may answer before the write returns, and its answer belongs after the question.
        record(splitter, chunk);
        child.stdin.write(decoder.decode(chunk, { stream: true }));
        child.stdin.flush();
    }

    const rest = decoder.decode();

    if (rest !== '') {
        child.stdin.write(rest);
    }

    record(splitter, null);
    child.stdin.end();
}

/* Cuts a byte stream into lines without the newline; a character split over two chunks stays whole. */
class LineSplitter {
    private readonly decoder = new TextDecoder();
    private pending = '';

    push(chunk: Uint8Array): string[] {
        this.pending += this.decoder.decode(chunk, { stream: true });
        const lines = this.pending.split('\n');
        this.pending = lines.pop() ?? '';

        return lines.filter((line) => line.trim() !== '');
    }

    end(): string[] {
        const rest = this.pending + this.decoder.decode();
        this.pending = '';

        return rest.trim() === '' ? [] : [rest];
    }
}

/* The real child, in the recorder's process group, so the signal a backend sends that group reaches the CLI as well. */
function spawnInGroup(started: (process: Bun.Subprocess) => void): SpawnChatProcess {
    return (options) => {
        const child = Bun.spawn({
            cmd: options.command,
            cwd: options.cwd,
            env: options.env,
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe'
        });

        started(child);
        void child.exited.then(() => options.onExit(child.exitCode, typeof child.signalCode === 'string' ? child.signalCode : null));

        return {
            pid: child.pid,
            stdin: child.stdin,
            stdout: child.stdout,
            stderr: child.stderr,
            kill: (signal) => child.kill(signal)
        };
    };
}

async function main(): Promise<void> {
    const parsed = parseArguments(process.argv.slice(2), existsSync);
    // `wx`: a recording never overwrites an earlier one. 0600: it holds a whole session.
    const file = openSync(parsed.out, 'wx', 0o600);
    let child: Bun.Subprocess | null = null;

    for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
        process.on(signal, () => child?.kill(signal));
    }

    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));

    const exit = await tee({
        command: parsed.command,
        cwd: process.cwd(),
        env,
        spawn: spawnInGroup((started) => {
            child = started;
        }),
        input: process.stdin as AsyncIterable<Uint8Array>,
        output: (chunk) => {
            process.stdout.write(chunk);
        },
        errorOutput: (chunk) => {
            process.stderr.write(chunk);
        },
        // Written at once, so a recorder that is killed keeps every line before it.
        record: (record) => {
            writeSync(file, `${JSON.stringify(record)}\n`);
        },
        now: () => performance.now(),
        stderr: parsed.stderr,
        envNames: parsed.envNames
    });

    closeSync(file);
    const signalNumber = exit.signal === null ? undefined : constants.signals[exit.signal as keyof typeof constants.signals];
    process.exit(exit.code ?? (signalNumber === undefined ? 1 : 128 + signalNumber));
}

if (import.meta.main) {
    await main();
}
