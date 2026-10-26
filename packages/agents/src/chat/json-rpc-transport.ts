import { errorText } from '../error-text.ts';
import { ChatChild, MAX_LINE_LENGTH, readStreamLines, type SpawnChatProcess } from './chat-process.ts';

export type JsonRpcFrame = Record<string, unknown>;

export interface JsonRpcTransportOptions {
    command: string[];
    cwd: string;
    env: Record<string, string>;
    spawn?: SpawnChatProcess;
    // How the agent is named in the errors this transport raises.
    label: string;
    // The `name` of an error the agent answered with, which callers tell apart from a silence or an exit.
    errorName?: string;
    // How long a request may go unanswered; null waits for as long as the process runs.
    requestTimeoutMs: number | null;
    // Whether every frame carries `"jsonrpc": "2.0"`; a protocol that leaves it out reads it as noise.
    versionField?: boolean;
    // Notifications and server requests; responses to our own requests settle their promise instead.
    onFrame(frame: JsonRpcFrame): void;
    onError?(error: Error): void;
    // `stderr` is the tail of what the process wrote there, for an exit with an error code only.
    onExit(exitCode: number | null, stderr: string | null): void;
}

export interface JsonRpcRequestOptions {
    // Overrides the transport's timeout for this request; null waits for as long as the process runs.
    timeoutMs?: number | null;
}

/* An error the other side answered a request with. */
export class JsonRpcError extends Error {
    readonly code: number | null;
    readonly data: unknown;

    constructor(name: string, method: string, error: unknown) {
        const detail = typeof error === 'object' && error !== null ? (error as { message?: unknown; code?: unknown; data?: unknown }) : {};
        super(`${method} failed: ${typeof detail.message === 'string' ? detail.message : JSON.stringify(error)}`);
        this.name = name;
        this.code = typeof detail.code === 'number' ? detail.code : null;
        this.data = detail.data;
    }
}

type Settle = { resolve(value: unknown): void; reject(reason: Error): void; method: string; timer: ReturnType<typeof setTimeout> | null };

/*
 * One child process and JSON-RPC on its stdio: newline-delimited JSON, a request carries an id and
 * gets a result or an error back under the same id, a notification has no id. The child also sends
 * requests of its own, answered with `respond` or `respondError`.
 */
export class JsonRpcTransport {
    private readonly child: ChatChild;
    private readonly options: JsonRpcTransportOptions;
    private readonly pending = new Map<number, Settle>();
    private nextId = 1;
    private closed = false;
    // Set once stdin ended or broke; a write after an EPIPE only raises the next one.
    private inputClosed = false;

    constructor(options: JsonRpcTransportOptions) {
        this.options = options;

        this.child = new ChatChild({
            command: options.command,
            cwd: options.cwd,
            env: options.env,
            ...(options.spawn ? { spawn: options.spawn } : {}),
            onError: (error) => this.broken(error),
            onExit: (exitCode, stderr) => this.handleExit(exitCode, stderr)
        });

        void this.readLines();
    }

    get pid(): number {
        return this.child.pid;
    }

    get alive(): boolean {
        return !this.closed;
    }

    request(method: string, params: unknown, options: JsonRpcRequestOptions = {}): Promise<unknown> {
        const label = this.options.label;
        const timeoutMs = options.timeoutMs === undefined ? this.options.requestTimeoutMs : options.timeoutMs;

        return new Promise((resolve, reject) => {
            if (this.closed) {
                reject(new Error(`${label} is not running`));

                return;
            }

            const id = this.nextId++;
            let timer: ReturnType<typeof setTimeout> | null = null;

            if (timeoutMs !== null) {
                timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new Error(`${method} failed: ${label} did not answer in ${timeoutMs / 1000} seconds`));
                }, timeoutMs);

                timer.unref?.();
            }

            this.pending.set(id, { resolve, reject, method, timer });

            try {
                this.write({ id, method, params });
            } catch (error) {
                if (timer !== null) {
                    clearTimeout(timer);
                }

                this.pending.delete(id);
                reject(error);
            }
        });
    }

    notify(method: string, params: unknown): void {
        this.write({ method, params });
    }

    respond(id: number | string, result: unknown): void {
        this.write({ id, result });
    }

    respondError(id: number | string, code: number, message: string): void {
        this.write({ id, error: { code, message } });
    }

    /* Closes stdin; the child ends on its own once it has nothing more to say. */
    end(): void {
        this.inputClosed = true;

        try {
            this.child.process.stdin.end();
        } catch {
            // Already closed by the other side.
        }
    }

    kill(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
        this.child.process.kill(signal);
    }

    stop(): void {
        this.end();
        this.child.endAfterGrace();
    }

    dispose(): Promise<void> {
        return this.child.end();
    }

    private write(frame: JsonRpcFrame): void {
        if (this.closed || this.inputClosed) {
            throw new Error(`${this.options.label} stdin is closed`);
        }

        try {
            const framed = this.options.versionField ? { jsonrpc: '2.0', ...frame } : frame;
            this.child.process.stdin.write(`${JSON.stringify(framed)}\n`);
            this.child.process.stdin.flush();
        } catch (error) {
            this.inputClosed = true;

            throw error;
        }
    }

    /* A pipe that failed takes no more writes; a frame a consumer choked on leaves it as it was. */
    private broken(error: unknown): void {
        this.inputClosed = true;
        this.failed(error);
    }

    private failed(error: unknown): void {
        const failure = new Error(`Lost the connection to ${this.options.label}: ${errorText(error)}`);
        this.rejectPending(() => failure);

        try {
            this.options.onError?.(failure);
        } catch (reportError) {
            console.error(`Reporting a ${this.options.label} transport failure failed:`, errorText(reportError));
        }
    }

    private readLine(line: string): void {
        try {
            this.handleLine(line);
        } catch (error) {
            this.failed(error);
        }
    }

    private async readLines(): Promise<void> {
        try {
            await readStreamLines(
                this.child.process.stdout,
                (line) => this.readLine(line),
                () =>
                    this.failed(
                        new Error(`${this.options.label} wrote a frame of more than ${MAX_LINE_LENGTH / 1_000_000} million characters, which was dropped`)
                    )
            );
        } catch (error) {
            if (!this.closed) {
                this.broken(error);
            }
        }
    }

    private handleLine(line: string): void {
        if (this.closed || line.trim() === '') {
            return;
        }

        let frame: unknown;

        try {
            frame = JSON.parse(line);
        } catch {
            return;
        }

        if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) {
            return;
        }

        const message = frame as JsonRpcFrame;

        if (typeof message.method === 'string') {
            this.options.onFrame(message);

            return;
        }

        const settle = typeof message.id === 'number' ? this.pending.get(message.id) : undefined;

        if (!settle) {
            return;
        }

        this.pending.delete(message.id as number);

        if (settle.timer !== null) {
            clearTimeout(settle.timer);
        }

        if (message.error !== undefined) {
            settle.reject(new JsonRpcError(this.options.errorName ?? 'JsonRpcError', settle.method, message.error));
        } else {
            settle.resolve(message.result);
        }
    }

    private handleExit(exitCode: number | null, stderr: string | null): void {
        if (this.closed) {
            return;
        }

        this.closed = true;
        this.rejectPending((method) => new Error(`${method} failed: ${this.options.label} exited`));
        this.options.onExit(exitCode, stderr);
    }

    private rejectPending(reason: (method: string) => Error): void {
        for (const settle of this.pending.values()) {
            if (settle.timer !== null) {
                clearTimeout(settle.timer);
            }

            settle.reject(reason(settle.method));
        }

        this.pending.clear();
    }
}
