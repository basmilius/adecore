import { spawn } from 'node:child_process';
import type { HelperProcess } from './types.ts';

export interface SpawnHelperOptions {
    readonly args?: readonly string[];
    /* Added over the environment of this process. */
    readonly env?: Readonly<Record<string, string>>;
    /* Receives each line the helper writes to stderr. */
    readonly onLog?: (line: string) => void;
}

/*
 * Cuts a stream into lines. A line can be megabytes, so pieces wait in a list and only the new chunk is
 * searched for a break; joining a growing string on every chunk would make a large line quadratic.
 */
const createLineSplitter = (onLine: (line: string) => void) => {
    let pieces: string[] = [];

    const emit = (line: string): void => {
        const clean = line.endsWith('\r') ? line.slice(0, -1) : line;

        if (clean.length > 0) {
            onLine(clean);
        }
    };

    return {
        push(chunk: string): void {
            let start = 0;
            let end = chunk.indexOf('\n');

            while (end !== -1) {
                pieces.push(chunk.slice(start, end));
                const line = pieces.join('');
                pieces = [];
                emit(line);
                start = end + 1;
                end = chunk.indexOf('\n', start);
            }

            if (start < chunk.length) {
                pieces.push(chunk.slice(start));
            }
        },
        flush(): void {
            const line = pieces.join('');
            pieces = [];
            emit(line);
        }
    };
};

/* Runs the helper binary at `path`, speaking one JSON message per line over stdin and stdout. */
export const spawnHelper = (path: string, options: SpawnHelperOptions = {}): HelperProcess => {
    const lineListeners: ((line: string) => void)[] = [];
    const exitListeners: ((code: number | null) => void)[] = [];
    let finished = false;
    let exitCode: number | null = null;
    let killed = false;

    const child = spawn(path, [...(options.args ?? [])], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: options.env ? { ...process.env, ...options.env } : process.env,
        windowsHide: true
    });

    const lines = createLineSplitter((line) => lineListeners.forEach((listener) => listener(line)));
    const logs = createLineSplitter((line) => options.onLog?.(line));

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => lines.push(chunk));
    child.stderr.on('data', (chunk: string) => logs.push(chunk));
    child.stdin.on('error', () => {});

    const finish = (code: number | null): void => {
        if (finished) {
            return;
        }

        finished = true;
        exitCode = code;
        lines.flush();
        logs.flush();
        exitListeners.forEach((listener) => listener(code));
    };

    child.on('error', (error) => {
        options.onLog?.(error.message);

        // Without a pid the process never started, and no `close` follows.
        if (child.pid === undefined) {
            finish(null);
        }
    });
    child.on('close', (code) => finish(code));

    return {
        write(line: string): void {
            if (!finished && child.stdin.writable) {
                child.stdin.write(`${line}\n`);
            }
        },
        onLine(listener): void {
            lineListeners.push(listener);
        },
        onExit(listener): void {
            if (finished) {
                queueMicrotask(() => listener(exitCode));
                return;
            }

            exitListeners.push(listener);
        },
        kill(): void {
            if (killed || finished) {
                return;
            }

            killed = true;
            child.kill();
        }
    };
};
