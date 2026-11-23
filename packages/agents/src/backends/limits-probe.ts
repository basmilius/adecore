import type { UsageLimitsProvider } from '@adecore/agent-contracts';
import { withDeadline, withTimeout } from '@adecore/utils/async';
import { isRecord } from '@adecore/utils/record';
import { processGroupAlive, spawnChatProcess, type ChatProcess, type SpawnChatProcess } from '../chat-process.ts';
import { systemClock, type Clock } from '../clock.ts';
import { errorText } from '../error-text.ts';
import { CodexTransport, type CodexClientInfo } from './codex-transport.ts';
import { readClaudeUsage, readCodexLimitsAnswer, type ProviderReading } from './limits.ts';

/* A CLI that has not answered by now is not going to; the next pass tries again. */
const PROBE_TIMEOUT_MS = 20_000;
// Codex often takes 2 to 8 seconds to read the plan's windows.
export const CODEX_READ_TIMEOUT_MS = 10_000;
// How long what the app-server started may finish after its input closed, under the probe's own deadline.
const GROUP_DRAIN_MS = 10_000;
const GROUP_POLL_MS = 250;

export type ProbeResult = ProviderReading | { unavailable: UsageLimitsProvider['unavailable'] };

function failure(message: string): ProbeResult {
    return { unavailable: { reason: 'failed', message } };
}

function timeoutOf<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
    return withTimeout(work, ms, `${what} did not answer in time`);
}

/*
 * Asks Claude Code what is left of the plan, without a turn and without a token of our own. A
 * `claude -p` on the stream-json protocol answers `get_usage` before any prompt, but only once it
 * has been initialized: without that first control request the process waits and says nothing.
 */
export async function probeClaude(command: readonly string[], env: Record<string, string>, spawn: SpawnChatProcess = spawnChatProcess): Promise<ProbeResult> {
    let child: ChatProcess;

    try {
        child = spawn({
            command: [...command, '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'],
            cwd: process.cwd(),
            env,
            onExit: () => undefined
        });
    } catch (error) {
        return failure(errorText(error));
    }

    const write = (frame: unknown): void => {
        child.stdin.write(`${JSON.stringify(frame)}\n`);
        child.stdin.flush();
    };

    const read = async (): Promise<ProbeResult> => {
        write({ type: 'control_request', request_id: 'probe-init', request: { subtype: 'initialize', hooks: {} } });
        let asked = false;
        let buffer = '';
        const decoder = new TextDecoder();

        for await (const chunk of child.stdout as unknown as AsyncIterable<Uint8Array>) {
            buffer += decoder.decode(chunk, { stream: true });
            let at = buffer.indexOf('\n');

            for (; at !== -1; at = buffer.indexOf('\n')) {
                const line = buffer.slice(0, at);
                buffer = buffer.slice(at + 1);
                let frame: unknown;

                try {
                    frame = JSON.parse(line);
                } catch {
                    continue;
                }

                if (typeof frame !== 'object' || frame === null) {
                    continue;
                }

                const envelope = frame as { type?: unknown; request_id?: unknown; response?: { subtype?: unknown; response?: unknown } };

                if (envelope.type !== 'control_response') {
                    continue;
                }

                if (!asked) {
                    asked = true;
                    write({ type: 'control_request', request_id: 'probe-usage', request: { subtype: 'get_usage' } });

                    continue;
                }

                if (envelope.response?.subtype === 'error') {
                    return failure('Claude Code refused to report its usage');
                }

                return readClaudeUsage(envelope.response?.response ?? envelope.response);
            }
        }

        return failure('Claude Code closed without reporting its usage');
    };

    try {
        return await timeoutOf(read(), PROBE_TIMEOUT_MS, 'Claude Code');
    } catch (error) {
        return failure(errorText(error));
    } finally {
        child.stdin.end();
        child.kill('SIGTERM');
    }
}

/*
 * Whether the account Codex runs on has a plan of its own, from `account/read`: an API key, Bedrock or a model
 * provider that needs no OpenAI sign-in has none, even where Codex still reads a ChatGPT login's windows from
 * the same home. Null when the answer does not say, so the windows decide.
 */
function hasPlan(answer: unknown): boolean | null {
    if (!isRecord(answer)) {
        return null;
    }

    if (isRecord(answer.account) && typeof answer.account.type === 'string') {
        return answer.account.type === 'chatgpt';
    }

    return answer.requiresOpenaiAuth === false ? false : null;
}

/* Polls until nothing of the group runs or the bound passes; true when something still ran at the bound. */
function outlives(pid: number, groupAlive: (pid: number) => boolean, clock: Clock): Promise<boolean> {
    const until = clock.now() + GROUP_DRAIN_MS;

    return new Promise((resolve) => {
        const look = (): void => {
            if (!groupAlive(pid)) {
                resolve(false);
            } else if (clock.now() >= until) {
                resolve(true);
            } else {
                clock.setTimeout(look, GROUP_POLL_MS);
            }
        };

        look();
    });
}

/* The same question to Codex: the app-server answers it over JSON-RPC right after the handshake. */
export async function probeCodex(
    command: readonly string[],
    env: Record<string, string>,
    client: CodexClientInfo,
    seams: { spawn?: SpawnChatProcess; clock?: Clock; groupAlive?: (pid: number) => boolean } = {}
): Promise<ProbeResult> {
    const clock = seams.clock ?? systemClock;
    const groupAlive = seams.groupAlive ?? processGroupAlive;
    let transport: CodexTransport | null = null;

    try {
        transport = new CodexTransport({
            command: [...command],
            cwd: process.cwd(),
            env,
            ...(seams.spawn ? { spawn: seams.spawn } : {}),
            onFrame: () => undefined,
            onExit: () => undefined
        });

        const open = transport;

        await withDeadline(
            open.request('initialize', { clientInfo: client, capabilities: { experimentalApi: true } }),
            PROBE_TIMEOUT_MS,
            'Codex did not answer in time',
            clock
        );

        open.notify('initialized', {});
        // A Codex without `account/read` refuses it; the windows then decide as before.
        const account = await withDeadline(open.request('account/read', {}), CODEX_READ_TIMEOUT_MS, 'Codex did not answer in time', clock).catch(() => null);

        if (hasPlan(account) === false) {
            return { unavailable: { reason: 'no-subscription', message: null } };
        }

        const answer = await withDeadline(open.request('account/rateLimits/read', undefined), CODEX_READ_TIMEOUT_MS, 'Codex did not answer in time', clock);
        const reading = readCodexLimitsAnswer(answer);

        // An account on an API key has no plan windows; Codex answers, with nothing in it.
        return reading ?? { unavailable: { reason: 'no-subscription', message: null } };
    } catch (error) {
        return failure(errorText(error));
    } finally {
        if (transport !== null) {
            transport.end();

            // `initialize` starts a sync of the plugin marketplaces in the app-server's group, `git` over ssh among it;
            // a signal halfway through an ssh agent's request makes the agent ask the person about an unknown app.
            if (await outlives(transport.pid, groupAlive, clock)) {
                transport.kill();
            }
        }
    }
}
