import type { SpawnChatProcess } from '../chat-process.ts';
import { JsonRpcTransport, type JsonRpcFrame } from './json-rpc-transport.ts';

export type CodexFrame = JsonRpcFrame;

/* How the host names itself in the `initialize` every app-server is opened with. */
export interface CodexClientInfo {
    name: string;
    title: string;
    version: string;
}

export const DEFAULT_CODEX_CLIENT: CodexClientInfo = { name: 'agents', title: 'Agents', version: '0.1.0' };

interface CodexTransportOptions {
    command: string[];
    cwd: string;
    env: Record<string, string>;
    spawn?: SpawnChatProcess;
    onFrame(frame: CodexFrame): void;
    onError?(error: Error): void;
    onExit(exitCode: number | null, stderr: string | null): void;
}

// The app-server answers every request it takes at once and does the work in notifications, so a silent one is stuck.
const REQUEST_TIMEOUT_MS = 60_000;

/* One `codex app-server` process. Its frames leave out the `jsonrpc` field, and an error it answers with is named `CodexRpcError`. */
export class CodexTransport extends JsonRpcTransport {
    constructor(options: CodexTransportOptions) {
        super({ ...options, label: 'Codex', errorName: 'CodexRpcError', requestTimeoutMs: REQUEST_TIMEOUT_MS });
    }
}
