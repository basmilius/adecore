import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RuntimeMode } from '@adecore/agent-contracts';
import type { BackendEvent, BackendLaunch, TurnInput } from '../backends/backend.ts';
import type { ApiHostTools, ToolRounds } from './api-chat.ts';
import { API_TOOLS, type ExecuteApiTool } from './api-tools.ts';
import { ChatCompletionsBackend, type ChatCompletionsSpec, type ChatCompletionsUsage } from './chat-completions-backend.ts';

const URL = 'https://api.example.test/v1';
const turn: TurnInput = { text: 'What is in the project?', preamble: null, attachments: [], mentions: [], skills: [] };

const folders: string[] = [];
const backends: ChatCompletionsBackend[] = [];

afterEach(async () => {
    await Promise.all(backends.splice(0).map((backend) => backend.dispose()));
    await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

function stream(...chunks: unknown[]): Response {
    return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`);
}

function toolCall(id: string, name: string, args: unknown): () => Response {
    return () =>
        stream({
            choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' }]
        });
}

const listCall = toolCall('call-1', 'list_files', { path: '.' });

const reply = (text: string) =>
    stream({
        choices: [{ delta: { content: text }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 120, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 20 }, completion_tokens_details: { reasoning_tokens: 5 } }
    });

/* What a backend reported, with a wait for the first event that fits (one already seen counts). */
class EventLog {
    readonly events: BackendEvent[] = [];
    private waiters: Array<{ predicate: (event: BackendEvent) => boolean; resolve: (event: BackendEvent) => void }> = [];

    onEvent(event: BackendEvent): void {
        this.events.push(event);
        const waiting = this.waiters;
        this.waiters = [];

        for (const waiter of waiting) {
            if (waiter.predicate(event)) {
                waiter.resolve(event);
            } else {
                this.waiters.push(waiter);
            }
        }
    }

    until(predicate: (event: BackendEvent) => boolean): Promise<BackendEvent> {
        const seen = this.events.find(predicate);

        return seen ? Promise.resolve(seen) : new Promise((resolve) => this.waiters.push({ predicate, resolve }));
    }

    get sessionId(): string {
        return (this.events.find((event) => event.type === 'session') as { agentSessionId: string }).agentSessionId;
    }
}

interface RigOptions {
    resume?: string;
    directory?: string;
    mode?: RuntimeMode;
    rounds?: ToolRounds;
    key?: string;
    hostTools?: ApiHostTools;
}

interface Body {
    model: string;
    messages: Array<{ role: string; content: string; tool_call_id?: string }>;
    tools?: Array<{ type: string; function: { name: string } }>;
    stream_options?: unknown;
}

/* A backend against a fake API that answers each request with the next response given. */
async function rig(responses: Array<() => Response>, options: RigOptions = {}) {
    const directory = options.directory ?? (await mkdtemp(join(tmpdir(), 'chat-completions-')));

    if (options.directory === undefined) {
        folders.push(directory);
    }

    const bodies: Body[] = [];
    const tools: string[] = [];
    const usage: ChatCompletionsUsage[] = [];
    const state = { key: options.key ?? 'api-key', rounds: options.rounds ?? { roundsPerRun: 40, runs: 5 } };
    const log = new EventLog();

    const spec: ChatCompletionsSpec = {
        name: 'Api',
        url: URL,
        request: async (url, init) => {
            expect(url).toBe(`${URL}/chat/completions`);
            expect(init.redirect).toBe('error');
            bodies.push(JSON.parse(String(init.body)));
            const next = responses.shift();

            return next ? next() : new Response('', { status: 500 });
        },
        apiKey: () => state.key,
        directory: () => directory,
        catalog: {
            resolveModel: (name) => (name === 'tool-model' ? name : null),
            contextWindowFor: () => 1000
        },
        supportsTools: () => true,
        toolRounds: () => state.rounds,
        httpError: (status) => new Error(status === 401 ? 'Api rejected the API key.' : `Api request failed (HTTP ${status}).`),
        onUsage: async (counted) => {
            usage.push(counted);
        },
        ...(options.hostTools === undefined ? {} : { hostTools: () => options.hostTools! }),
        words: {
            noKey: 'Add an Api key.',
            unknownModel: 'Refresh the Api models.',
            disconnected: 'Api was disconnected.',
            failed: 'Api could not finish this turn.',
            approval: 'Api requests access to this project.'
        }
    };

    const executeTool: ExecuteApiTool = async (_cwd, call) => {
        tools.push(call.name);

        return { output: 'a.txt\nb.txt', failed: false };
    };

    const launch: BackendLaunch = {
        command: ['api'],
        cwd: directory,
        env: {},
        selection: { model: 'tool-model', options: {} },
        modelName: 'Tool model',
        runtimeMode: options.mode ?? 'supervised',
        resume: options.resume ?? null,
        generation: 1,
        instructions: 'Be brief.',
        resumeNote: null
    };

    const backend = new ChatCompletionsBackend(launch, { onEvent: (event) => log.onEvent(event) }, spec, executeTool);
    backends.push(backend);

    return {
        backend,
        state,
        directory,
        events: log.events,
        bodies,
        tools,
        usage,
        get sessionId() {
            return log.sessionId;
        },
        until: (predicate: (event: BackendEvent) => boolean) => log.until(predicate)
    };
}

const isDone = (event: BackendEvent) => event.type === 'turn.done';

describe('a chat on a chat completions API', () => {
    test('a tool runs only after approval and the model hears its result', async () => {
        const chat = await rig([listCall, () => reply('Two files.')]);
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        const approval = await chat.until((event) => event.type === 'approval.requested');
        expect(approval).toMatchObject({
            toolName: 'ListFiles',
            input: { path: '.' },
            canAllowAlways: false,
            description: 'Api requests access to this project.'
        });
        expect(chat.tools).toEqual([]);
        chat.backend.respondApproval((approval as { requestId: string }).requestId, 'allow');

        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.tools).toEqual(['list_files']);
        expect(chat.events).toContainEqual(expect.objectContaining({ type: 'text.done', text: 'Two files.' }));
        expect(chat.events).toContainEqual(expect.objectContaining({ type: 'usage', contextTokens: 120, contextWindow: 1000 }));
        expect(chat.bodies).toHaveLength(2);
        expect(chat.bodies[0]!.model).toBe('tool-model');
        expect(chat.bodies[0]!.messages[0]).toMatchObject({ role: 'system' });
        expect(chat.bodies[0]!.messages[0]!.content).toContain('Be brief.');
        expect(chat.bodies[0]!.tools?.length).toBeGreaterThan(0);
        expect(chat.bodies[1]!.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call-1', content: 'a.txt\nb.txt' });
    });

    test('full access runs every tool without asking', async () => {
        const chat = await rig([listCall, () => reply('Two files.')], { mode: 'full-access' });
        await chat.backend.start();
        expect(chat.events).toContainEqual(expect.objectContaining({ type: 'session', effectiveRuntimeMode: 'full-access' }));
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.tools).toEqual(['list_files']);
        expect(chat.events.some((event) => event.type === 'approval.requested')).toBe(false);
    });

    test('accepting edits lets reads and edits through and still asks for a command', async () => {
        const command = toolCall('call-2', 'run_command', { command: 'echo hi' });
        const chat = await rig([listCall, command, () => reply('Done.')], { mode: 'auto-accept-edits' });
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        const approval = (await chat.until((event) => event.type === 'approval.requested')) as { requestId: string; toolName: string };
        expect(approval.toolName).toBe('Bash');
        // The read before it went through without a card.
        expect(chat.tools).toEqual(['list_files']);
        chat.backend.respondApproval(approval.requestId, 'allow');
        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.tools).toEqual(['list_files', 'run_command']);
    });

    test('auto has no classifier here and works as accepting edits', async () => {
        const chat = await rig([], { mode: 'auto' });
        await chat.backend.start();

        expect(chat.events).toContainEqual(expect.objectContaining({ type: 'session', effectiveRuntimeMode: 'auto-accept-edits' }));
    });

    test('every request that reports its counts is told to the host, and the API is asked for the counts', async () => {
        const chat = await rig([() => reply('Hi.')]);
        await chat.backend.start();
        chat.backend.sendTurn(turn);
        await chat.until(isDone);

        expect(chat.bodies[0]!.stream_options).toEqual({ include_usage: true });
        expect(chat.usage).toEqual([
            { model: 'tool-model', session: chat.sessionId, cwd: chat.directory, prompt: 120, cached: 20, completion: 30, reasoning: 5 }
        ]);
    });

    test('a question is a card the person answers, in any mode, and the model hears the answer', async () => {
        const ask = toolCall('call-q', 'ask_user', { question: 'Which name?', options: ['claude-api', 'anthropic'] });
        const chat = await rig([ask, () => reply('Using anthropic.')], { mode: 'full-access' });
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        const card = (await chat.until((event) => event.type === 'question.requested')) as {
            requestId: string;
            questions: Array<{ id: string; question: string; choices: Array<{ label: string }>; multiSelect: boolean }>;
        };

        expect(card.questions).toEqual([
            expect.objectContaining({
                id: card.requestId,
                question: 'Which name?',
                choices: [expect.objectContaining({ label: 'claude-api' }), expect.objectContaining({ label: 'anthropic' })],
                multiSelect: false
            })
        ]);
        // Nothing to approve: a question is the person's whatever the mode is.
        expect(chat.events.some((event) => event.type === 'approval.requested')).toBe(false);

        expect(chat.backend.respondQuestion(card.requestId, { [card.requestId]: 'anthropic' })).toBe(true);
        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.bodies[1]!.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call-q', content: 'anthropic' });
        expect(chat.tools).toEqual([]);
        // An answer to a question that is not open, or one that is not text, is refused.
        expect(chat.backend.respondQuestion(card.requestId, { [card.requestId]: 'again' })).toBe(false);
    });

    test('a question the person declines, or a stop while it waits, ends without an answer', async () => {
        const ask = toolCall('call-q', 'ask_user', { question: 'Sure?' });
        const declined = await rig([ask, () => reply('Fine.')]);
        await declined.backend.start();
        declined.backend.sendTurn(turn);
        const card = (await declined.until((event) => event.type === 'question.requested')) as { requestId: string };

        expect(declined.backend.declineRequest(card.requestId)).toBe(true);
        expect(await declined.until(isDone)).toMatchObject({ state: 'done' });
        expect(declined.bodies[1]!.messages.at(-1)?.content).toContain('declined');

        const stopped = await rig([ask]);
        await stopped.backend.start();
        stopped.backend.sendTurn(turn);
        const open = (await stopped.until((event) => event.type === 'question.requested')) as { requestId: string };
        stopped.backend.interrupt();

        expect(await stopped.until(isDone)).toMatchObject({ state: 'aborted' });
        expect(stopped.events).toContainEqual({ type: 'request.withdrawn', requestId: open.requestId });
    });

    test('a run that reaches its limit of tool rounds goes on by itself, and says so', async () => {
        const chat = await rig([listCall, listCall, () => reply('Done.')], { mode: 'full-access', rounds: { roundsPerRun: 2, runs: 3 } });
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.tools).toEqual(['list_files', 'list_files']);
        expect(chat.events).toContainEqual({ type: 'note', level: 'info', text: 'Continuing after 2 tool rounds.' });

        // The model hears it was cut and is told to carry on, as a message of the person's would say.
        const last = chat.bodies[2]!.messages.at(-1)!;
        expect(last.role).toBe('user');
        expect(last.content).toContain('limit of tool rounds');
    });

    test('the rounds are read as the run starts: with one run it stops at its first cut', async () => {
        const chat = await rig([listCall, listCall, listCall, listCall, listCall, () => reply('Never.')], { mode: 'full-access' });
        await chat.backend.start();
        chat.state.rounds = { roundsPerRun: 5, runs: 1 };
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'error', error: 'Api reached 5 tool rounds. Send another message to continue.' });
        expect(chat.tools).toHaveLength(5);
        expect(chat.events.some((event) => event.type === 'note')).toBe(false);
    });

    test('a loop that never ends still stops, after the runs it is allowed', async () => {
        const chat = await rig([listCall, listCall, listCall, listCall], { mode: 'full-access', rounds: { roundsPerRun: 2, runs: 2 } });
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'error', error: 'Api reached 4 tool rounds. Send another message to continue.' });
        expect(chat.tools).toHaveLength(4);
    });

    test('a denied tool does not run and the model is told so', async () => {
        const chat = await rig([listCall, () => reply('Understood.')]);
        await chat.backend.start();
        chat.backend.sendTurn(turn);
        const approval = (await chat.until((event) => event.type === 'approval.requested')) as { requestId: string };
        chat.backend.respondApproval(approval.requestId, 'deny');

        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.tools).toEqual([]);
        expect(chat.bodies[1]!.messages.at(-1)?.content).toContain('denied');
    });

    test('a stop while a tool waits withdraws the approval and ends the turn as aborted', async () => {
        const chat = await rig([listCall]);
        await chat.backend.start();
        chat.backend.sendTurn(turn);
        const approval = (await chat.until((event) => event.type === 'approval.requested')) as { requestId: string };
        chat.backend.interrupt();

        expect(await chat.until(isDone)).toMatchObject({ state: 'aborted' });
        expect(chat.events).toContainEqual({ type: 'request.withdrawn', requestId: approval.requestId });
        expect(chat.tools).toEqual([]);
    });

    test('an HTTP error ends the turn with the sentence of the spec and never the response', async () => {
        const chat = await rig([() => new Response('{"error":"bad key api-key"}', { status: 401 })]);
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'error', error: 'Api rejected the API key.' });
        expect(JSON.stringify(chat.events)).not.toContain('api-key');
    });

    test('a failure that names nothing of its own ends the turn with the words for it', async () => {
        const chat = await rig([() => reply('Hi.')]);
        await chat.backend.start();
        chat.state.key = '';
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'error', error: 'Api was disconnected.' });

        const broken = await rig([() => new Response('data: {not json}\n\n')]);
        await broken.backend.start();
        broken.backend.sendTurn(turn);

        expect(await broken.until(isDone)).toMatchObject({ state: 'error', error: 'Api could not finish this turn.' });
    });

    test('a resumed chat continues the saved conversation', async () => {
        const first = await rig([() => reply('First answer.')]);
        await first.backend.start();
        const session = first.sessionId;
        first.backend.sendTurn(turn);
        await first.until(isDone);
        await first.backend.dispose();

        const second = await rig([() => reply('Second answer.')], { resume: session, directory: first.directory });
        await second.backend.start();
        second.backend.sendTurn({ ...turn, text: 'And now?' });
        await second.until(isDone);

        expect(second.bodies[0]!.messages.slice(1).map((message) => message.content)).toEqual(['What is in the project?', 'First answer.', 'And now?']);

        const saved = JSON.parse(await readFile(join(first.directory, `${session}.json`), 'utf8'));
        expect(saved).toHaveLength(4);
    });

    test('a chat does not start without a key', async () => {
        const keyless = await rig([], { key: '' });
        await expect(keyless.backend.start()).rejects.toThrow('Add an Api key.');
    });
});

describe('the tools of the host', () => {
    function hostTools(run: ApiHostTools['run'], name = 'host_list') {
        const state = { closed: false };

        const tools: ApiHostTools = {
            definitions: async () => [{ name, description: 'Lists nodes.', parameters: { type: 'object', properties: {} } }],
            run,
            close: async () => {
                state.closed = true;
            }
        };

        return { tools, state };
    }

    test('are offered beside the project tools and run without a card, in any mode', async () => {
        const calls: Array<{ name: string; input: Record<string, unknown> }> = [];

        const host = hostTools(async (name, input) => {
            calls.push({ name, input });

            return { output: 'node\tn1\tNote', failed: false };
        });

        const chat = await rig([toolCall('call-h', 'host_list', {}), () => reply('One node.')], { hostTools: host.tools });
        await chat.backend.start();
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });
        expect(chat.bodies[0]!.tools?.map((tool) => tool.function.name)).toEqual([...API_TOOLS.map((tool) => tool.name), 'host_list']);
        expect(chat.bodies[1]!.tools).toEqual(chat.bodies[0]!.tools);
        expect(calls).toEqual([{ name: 'host_list', input: {} }]);
        expect(chat.events.some((event) => event.type === 'approval.requested')).toBe(false);
        expect(chat.events.filter((event) => event.type === 'tool.started' || event.type === 'tool.done').map((event) => event.type)).toEqual([
            'tool.started',
            'tool.done'
        ]);
        expect(chat.bodies[1]!.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call-h', content: 'node\tn1\tNote' });

        await chat.backend.dispose();
        expect(host.state.closed).toBe(true);
    });

    test('a host tool named like a project tool is refused, so it cannot skip that tool approval', async () => {
        let ran = false;

        const host = hostTools(async () => {
            ran = true;

            return { output: 'written', failed: false };
        }, 'write_file');

        const chat = await rig([toolCall('call-w', 'write_file', { path: 'a.txt', content: 'x' }), () => reply('Done.')], {
            mode: 'supervised',
            hostTools: host.tools
        });

        await chat.backend.start();
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'error' });
        expect(ran).toBe(false);
    });

    test('a name the host does not offer, bad arguments, or a call that throws fail and the model hears why', async () => {
        const host = hostTools(async () => {
            throw new Error('the server went away');
        });

        const chat = await rig(
            [toolCall('call-1', 'host_delete', {}), toolCall('call-2', 'host_list', [1]), toolCall('call-3', 'host_list', {}), () => reply('Sorry.')],
            { mode: 'full-access', hostTools: host.tools }
        );

        await chat.backend.start();
        chat.backend.sendTurn(turn);

        expect(await chat.until(isDone)).toMatchObject({ state: 'done' });

        const answers = chat.bodies.slice(1, 4).map((body) => body.messages.at(-1)?.content);
        expect(answers).toEqual(['Invalid or unsupported tool arguments.', 'Invalid or unsupported tool arguments.', 'Tool failed: the server went away']);
    });
});
