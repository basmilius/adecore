import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:os';
import { Readable } from 'node:stream';
import { clipText } from '@adecore/agent-contracts';
import { cancellableTimeout } from '@adecore/utils/async';
import type { ApiToolResult } from './api-tools.ts';

interface ApiCommandProcess {
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
    exited: Promise<number>;
    killGroup(): void;
}

export interface ApiCommandDependencies {
    spawn(cwd: string, command: string, env: Record<string, string | undefined>): ApiCommandProcess;
    scheduleTimeout(callback: () => void, milliseconds: number): () => void;
}

function commandProcess(child: ChildProcess, killGroup: () => void): ApiCommandProcess {
    const exited = new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            const signalNumber = signal === null ? undefined : constants.signals[signal];

            resolve(code ?? (signalNumber === undefined ? 1 : 128 + signalNumber));
        });
    });

    // Both pipes exist, since every spawn here pipes stdout and stderr; the cast reads Node's web stream as the global one.
    const web = (stream: Readable | null) => Readable.toWeb(stream!) as unknown as ReadableStream<Uint8Array>;

    return {
        stdout: web(child.stdout),
        stderr: web(child.stderr),
        exited,
        killGroup
    };
}

function spawnShell(cwd: string, command: string, env: Record<string, string | undefined>): ApiCommandProcess {
    // Approval permits a local shell command; cwd is not an operating system sandbox.
    const child = spawn('/bin/sh', ['-c', command], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });

    return commandProcess(child, () => {
        if (child.pid === undefined) {
            return;
        }

        try {
            process.kill(-child.pid, 'SIGKILL');
        } catch {
            // The process group may already be gone.
        }
    });
}

function spawnPowerShell(cwd: string, command: string, env: Record<string, string | undefined>): ApiCommandProcess {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });

    return commandProcess(child, () => {
        if (child.pid === undefined) {
            return;
        }

        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        killer.once('error', () => undefined);
    });
}

const defaults: ApiCommandDependencies = {
    spawn: (cwd, command, env) => (process.platform === 'win32' ? spawnPowerShell : spawnShell)(cwd, command, env),
    scheduleTimeout: (callback, milliseconds) => cancellableTimeout(milliseconds, callback)
};

export async function executeApiCommand(
    cwd: string,
    command: string,
    signal?: AbortSignal,
    env: Record<string, string | undefined> = process.env,
    dependencies: Partial<ApiCommandDependencies> = {}
): Promise<ApiToolResult> {
    signal?.throwIfAborted();

    if (!command.trim() || Buffer.byteLength(command) > 16_000 || command.includes('\0')) {
        throw new Error('Use a nonempty shell command of at most 16000 bytes.');
    }

    const child = (dependencies.spawn ?? defaults.spawn)(cwd, command, env);
    const retained: Uint8Array[] = [];
    let retainedBytes = 0;
    let truncated = false;
    let timedOut = false;
    let stopped = false;
    let settleStop!: () => void;

    const stoppedPromise = new Promise<void>((resolve) => {
        settleStop = resolve;
    });

    const readers = [child.stdout.getReader(), child.stderr.getReader()];
    let killed = false;

    // Once is enough: on Windows every kill starts a `taskkill` of its own, also for a pid that is gone.
    const killGroup = () => {
        if (!killed) {
            killed = true;
            child.killGroup();
        }
    };

    const stop = () => {
        if (stopped) {
            return;
        }

        stopped = true;
        killGroup();

        for (const reader of readers) {
            void reader.cancel().catch(() => undefined);
        }

        settleStop();
    };

    const cancelTimeout = (dependencies.scheduleTimeout ?? defaults.scheduleTimeout)(() => {
        timedOut = true;
        stop();
    }, 30_000);

    signal?.addEventListener('abort', stop, { once: true });

    const drain = async (reader: (typeof readers)[number]) => {
        try {
            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    break;
                }

                const remaining = Math.max(0, 4500 - retainedBytes);

                if (value.length > remaining) {
                    truncated = true;
                }

                if (remaining > 0) {
                    const bytes = value.slice(0, remaining);
                    retained.push(bytes);
                    retainedBytes += bytes.length;
                }
            }
        } catch {
            if (!stopped) {
                truncated = true;
            }
        }
    };

    try {
        if (signal?.aborted) {
            stop();
        }

        const draining = Promise.all(readers.map(drain));

        const completed = child.exited.then(async (code) => {
            // A shell can exit while a background child still holds its output pipes.
            killGroup();
            await draining;

            return code;
        });

        // A process that failed to start after a stop already settled the race has nobody left to tell.
        void completed.catch(() => undefined);
        const exitCode = await Promise.race([completed, stoppedPromise.then(() => null)]);
        signal?.throwIfAborted();
        let output = new TextDecoder().decode(Buffer.concat(retained));

        const serialized = () =>
            JSON.stringify({
                exitCode,
                timedOut,
                truncated,
                output,
                ...(timedOut ? { note: 'Command stopped after 30 seconds; output is partial.' } : truncated ? { note: 'Output was truncated.' } : {})
            });

        while (Buffer.byteLength(serialized()) > 6000) {
            truncated = true;
            output = clipText(output, Math.floor(output.length * 0.9));
        }

        return {
            output: serialized(),
            failed: timedOut || exitCode !== 0
        };
    } finally {
        cancelTimeout();
        signal?.removeEventListener('abort', stop);
        stop();
    }
}
