import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withDeadline } from '../../async.ts';
import { DEFAULT_ACP_CLIENT, type AcpClientInfo } from '../../chat/acp-backend.ts';
import {
    ACP_AUTH_REQUIRED,
    ACP_PROTOCOL_VERSION,
    parseInitialize,
    parseSessionInfo,
    sessionIdOf,
    sessionUpdateOf,
    type AcpSessionInfo
} from '../../chat/acp-protocol.ts';
import type { SpawnChatProcess } from '../../chat/chat-process.ts';
import { JsonRpcError, JsonRpcTransport, type JsonRpcFrame } from '../../chat/json-rpc-transport.ts';
import { definedEnv } from './launch.ts';
import { ASK_TIMEOUT_MS, type AccountReading } from './status.ts';

/* The clock the probe's deadline runs on. */
export interface ProbeTimer {
    setTimeout(run: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}

export interface AcpAccountProbe {
    // The agent as a person reads it, in the error a failed read carries.
    name: string;
    command: readonly string[];
    env: Record<string, string | undefined>;
    client?: AcpClientInfo;
    spawn?: SpawnChatProcess;
    timeoutMs?: number;
    timer?: ProbeTimer;
    // What the probe's session offered, for a host that fills its model catalog from the agent.
    onSession?(info: AcpSessionInfo): void;
    // The slash commands the probe's session offered, when the agent listed them before the session closed.
    onCommands?(commands: string[]): void;
}

const SIGNED_OUT: AccountReading = { signedIn: false, email: null, plan: null, organization: null };
const SIGNED_IN: AccountReading = { signedIn: true, email: null, plan: null, organization: null };

/*
 * Asks an ACP agent whether the account's environment is signed in: a session it opens means yes, "authentication
 * required" means no. ACP has no request that says who, so a reading carries no email or plan. The session is opened
 * in an empty folder of its own with no MCP servers, and `authenticate` is never sent: a probe must not start a login.
 */
export async function askAcpAccount(probe: AcpAccountProbe): Promise<AccountReading> {
    const folder = await mkdtemp(join(tmpdir(), 'acp-account-'));
    const client = probe.client ?? DEFAULT_ACP_CLIENT;
    let transport: JsonRpcTransport | null = null;
    // An agent may list its commands before it answers with the session's id.
    const listed = new Map<string, string[]>();
    let sessionId: string | null = null;
    const noteCommands = (frame: JsonRpcFrame): void => {
        const update = frame.method === 'session/update' && (frame.id === undefined || frame.id === null) ? sessionUpdateOf(frame.params) : null;
        if (update === null || update.commands === null) {
            return;
        }
        if (sessionId === null) {
            listed.set(update.sessionId, update.commands);
        } else if (update.sessionId === sessionId) {
            probe.onCommands?.(update.commands);
        }
    };
    try {
        const started = new JsonRpcTransport({
            command: [...probe.command],
            cwd: folder,
            env: definedEnv(probe.env),
            ...(probe.spawn ? { spawn: probe.spawn } : {}),
            label: probe.name,
            errorName: 'AcpRpcError',
            // The probe's own deadline covers every request.
            requestTimeoutMs: null,
            versionField: true,
            onFrame: (frame) => {
                noteCommands(frame);
                refuseRequest(started, frame);
            },
            onExit: () => undefined
        });
        transport = started;
        const reading = async (): Promise<AccountReading> => {
            const capabilities = parseInitialize(
                await started.request('initialize', {
                    protocolVersion: ACP_PROTOCOL_VERSION,
                    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
                    clientInfo: { name: client.name, title: client.title ?? client.name, version: client.version }
                })
            );
            if (capabilities.protocolVersion !== ACP_PROTOCOL_VERSION) {
                throw new Error(`${probe.name} speaks ACP version ${capabilities.protocolVersion}; only version ${ACP_PROTOCOL_VERSION} is supported`);
            }
            let result: unknown;
            try {
                result = await started.request('session/new', { cwd: folder, mcpServers: [] });
            } catch (error) {
                if (error instanceof JsonRpcError && error.code === ACP_AUTH_REQUIRED) {
                    return SIGNED_OUT;
                }
                throw error;
            }
            sessionId = sessionIdOf(result);
            if (sessionId === null) {
                throw new Error(`${probe.name} opened a session without an id`);
            }
            probe.onSession?.(parseSessionInfo(result, sessionId, capabilities.agent));
            const commands = listed.get(sessionId);
            if (commands !== undefined) {
                probe.onCommands?.(commands);
            }
            if (capabilities.closeSession) {
                // The answer is known by now; an agent that cannot close it keeps an empty session, nothing worse.
                await started.request('session/close', { sessionId }).catch(() => undefined);
            }
            return SIGNED_IN;
        };
        return await withDeadline(reading(), probe.timeoutMs ?? ASK_TIMEOUT_MS, `${probe.name} did not answer in time`, probe.timer);
    } finally {
        await transport?.dispose();
        await rm(folder, { recursive: true, force: true });
    }
}

/* The probe advertises nothing, so a request from the agent gets a refusal rather than a silence it would wait on. */
function refuseRequest(transport: JsonRpcTransport, frame: JsonRpcFrame): void {
    if (frame.id === undefined || frame.id === null || !transport.alive) {
        return;
    }
    try {
        transport.respondError(frame.id as number | string, -32601, `Method not found: ${String(frame.method)}`);
    } catch {
        // The agent closed its input; the deadline or the exit settles the probe.
    }
}
