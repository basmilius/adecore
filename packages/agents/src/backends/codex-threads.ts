import { isRecord } from '@adecore/utils/record';
import { ChatError } from '../chat-error.ts';
import { errorText } from '../error-text.ts';
import { CodexTransport, type CodexClientInfo } from './codex-transport.ts';
import type { ProviderThreads, ThreadForkParams, ThreadItemsParams, ThreadProcess } from './threads.ts';

/* One `thread/items/list` answer as far as a reader needs it: the entries newest first, and the cursor to older ones. */
export function parseThreadItemsPage(result: unknown): { entries: Record<string, unknown>[]; nextCursor: string | null } {
    const data = isRecord(result) && Array.isArray(result.data) ? result.data.filter(isRecord) : [];
    const nextCursor = isRecord(result) && typeof result.nextCursor === 'string' && result.nextCursor !== '' ? result.nextCursor : null;

    return { entries: data, nextCursor };
}

/* An app-server started for the questions `work` asks and ended after them, for a chat whose own process may not run. */
async function withAppServer<T>(client: CodexClientInfo, spec: ThreadProcess, work: (transport: CodexTransport) => Promise<T>): Promise<T> {
    const transport = new CodexTransport({
        command: spec.command,
        cwd: spec.cwd,
        env: spec.env,
        ...(spec.spawn ? { spawn: spec.spawn } : {}),
        onFrame: () => undefined,
        onExit: () => undefined
    });

    try {
        await transport.request('initialize', {
            clientInfo: client,
            capabilities: { experimentalApi: true, requestAttestation: false }
        });

        transport.notify('initialized', {});

        return await work(transport);
    } finally {
        transport.end();
        transport.kill('SIGTERM');
    }
}

/*
 * A page asked of an app-server started for this one question, for a chat whose own process is not
 * running. The app-server reads a thread it never loaded from disk (checked against codex-cli 0.154.0),
 * so nothing has to be resumed first.
 */
function listThreadItemsOnce(client: CodexClientInfo, spec: ThreadProcess, params: ThreadItemsParams): Promise<unknown> {
    return withAppServer(client, spec, (transport) => transport.request('thread/items/list', params));
}

async function nthTurnId(transport: CodexTransport, threadId: string, turns: number): Promise<string | null> {
    let seen = 0;
    let cursor: string | null = null;

    do {
        const page = parseThreadItemsPage(
            await transport.request('thread/turns/list', { threadId, limit: 100, sortDirection: 'asc', ...(cursor === null ? {} : { cursor }) })
        );

        for (const turn of page.entries) {
            if (++seen === turns) {
                return typeof turn.id === 'string' ? turn.id : null;
            }
        }

        cursor = page.nextCursor;
    } while (cursor !== null);

    return null;
}

/*
 * A new thread with the turns of `threadId` up to the one named, through `thread/fork`, and its id.
 * Asked of a process of its own even while the chat's backend holds the thread: measured against
 * codex-cli 0.154.0, with the original answering on in its own process afterwards.
 */
function forkThreadOnce(client: CodexClientInfo, spec: ThreadProcess, params: ThreadForkParams): Promise<string> {
    return withAppServer(client, spec, async (transport) => {
        let lastTurnId: string | null = null;

        if (params.at !== null) {
            lastTurnId = 'turnId' in params.at ? params.at.turnId : await nthTurnId(transport, params.threadId, params.at.turns);

            if (lastTurnId === null) {
                throw new ChatError('turn-not-found', 'Codex keeps fewer turns in this thread than the chat shows, so the turn could not be found');
            }
        }

        let result: unknown;

        try {
            result = await transport.request('thread/fork', {
                threadId: params.threadId,
                excludeTurns: true,
                ...params.options,
                ...(lastTurnId === null ? {} : { lastTurnId })
            });
        } catch (error) {
            throw new ChatError('fork-failed', errorText(error));
        }

        const thread = isRecord(result) && isRecord(result.thread) ? result.thread : null;

        if (thread === null || typeof thread.id !== 'string' || thread.id === '') {
            throw new ChatError('fork-failed', 'Codex answered the fork without a thread');
        }

        return thread.id;
    });
}

export function codexThreads(client: CodexClientInfo): ProviderThreads {
    return {
        listItems: (spec, params) => listThreadItemsOnce(client, spec, params),
        fork: (spec, params) => forkThreadOnce(client, spec, params)
    };
}
