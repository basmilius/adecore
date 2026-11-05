import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { ModelSelection, RuntimeMode } from '@adecore/agent-contracts';
import { z } from 'zod';
import type { ApprovalDecision, BackendHost, BackendLaunch, ChatBackend, TurnInput } from '../backends/backend.ts';
import { ApiTools, CONTINUE_MESSAGE, INTERRUPTED, apiInstructions, endTurn, readThread, writeThread, type ApiHostTools, type ToolRounds } from './api-chat.ts';
import { apiEffectiveMode, executeApiTool, type ExecuteApiTool } from './api-tools.ts';
import { readChatCompletionsStream, type ChatCompletionsAnswer, type ChatCompletionsTokens } from './chat-completions-stream.ts';

const MessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.string(),
    reasoning_content: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z
        .array(
            z.object({
                id: z.string(),
                type: z.literal('function'),
                function: z.object({ name: z.string(), arguments: z.string() })
            })
        )
        .optional()
});
type Message = z.infer<typeof MessageSchema>;

// A request that streams nothing for this long is not coming back.
const REQUEST_TIMEOUT_MS = 180_000;

/** One request a chat made, with the tokens the API counted for it. */
export interface ChatCompletionsUsage extends ChatCompletionsTokens {
    model: string;
    session: string;
    cwd: string;
}

/** The sentences a person reads that name what to do in the host, beside the ones the backend writes itself. */
export interface ChatCompletionsWords {
    /** Why a chat does not start without a key. */
    noKey: string;

    /** Why a chat does not start on a model the catalog does not know. */
    unknownModel: string;

    /** Why a turn ends once the key is gone. */
    disconnected: string;

    /** The error of a turn that failed on anything that is not a sentence of the backend's own. */
    failed: string;

    /** The description on an approval card. */
    approval: string;
}

export interface ChatCompletionsSpec {
    /** The API as a person reads it. Every error the backend writes starts with it, and only such an error reaches the person as it is. */
    name: string;

    /** The base URL. A request goes to `<url>/chat/completions` and follows no redirect. */
    url: string;

    request(url: string, init: RequestInit): Promise<Response>;

    /** Sent as a bearer token, read before every request; empty means none is set. */
    apiKey(): string;

    /** The folder that keeps each chat's thread as `<session id>.json`. */
    directory(): string;

    catalog: {
        resolveModel(name: string): string | null;
        contextWindowFor(selection: ModelSelection): number | null;
    };

    /** Whether the model takes tools; one that does not is offered none. */
    supportsTools(model: string): boolean;

    /** Read as each run starts, so a change holds from the next message. */
    toolRounds(): ToolRounds;

    /** The error for a status that is not ok. Never build it from the body, which may quote the request and with it the key. */
    httpError(status: number): Error;

    /** The tokens of every request that reported them, awaited before a stop can end the turn. */
    onUsage?(usage: ChatCompletionsUsage): Promise<void>;

    /** Tools the host offers beside the project tools; null offers none. */
    hostTools?(launch: BackendLaunch, host: BackendHost): ApiHostTools | null;

    words: ChatCompletionsWords;
}

/* A chat on an API that keeps no conversation, so the thread is a file the backend writes after every step. */
export class ChatCompletionsBackend implements ChatBackend {
    readonly pid = null;
    private opened = false;
    private controller: AbortController | null = null;
    private work: Promise<void> | null = null;
    private messages: Message[] = [];
    private readonly sessionId: string;
    private readonly path: string;
    private readonly launch: BackendLaunch;
    private readonly host: BackendHost;
    private readonly spec: ChatCompletionsSpec;
    private readonly tools: ApiTools;
    private readonly mode: RuntimeMode;

    constructor(launch: BackendLaunch, host: BackendHost, spec: ChatCompletionsSpec, executeTool: ExecuteApiTool = executeApiTool) {
        this.launch = launch;
        this.host = host;
        this.spec = spec;
        // A change of mode restarts the backend, so the mode it started with holds for its whole life.
        this.mode = apiEffectiveMode(launch.runtimeMode);

        this.tools = new ApiTools({
            launch,
            host,
            mode: this.mode,
            approval: spec.words.approval,
            executeTool,
            hostTools: spec.hostTools?.(launch, host) ?? null
        });

        this.sessionId = launch.resume ?? randomUUID();

        if (!z.string().uuid().safeParse(this.sessionId).success) {
            throw new Error(`Invalid ${spec.name} session id.`);
        }

        this.path = join(spec.directory(), `${this.sessionId}.json`);
    }

    get running(): boolean {
        return this.opened;
    }

    async start(): Promise<void> {
        if (this.opened) {
            return;
        }

        if (!this.spec.apiKey()) {
            throw new Error(this.spec.words.noKey);
        }

        if (!this.spec.catalog.resolveModel(this.launch.selection.model)) {
            throw new Error(this.spec.words.unknownModel);
        }

        if (this.launch.resume) {
            this.messages = await readThread(this.path, z.array(MessageSchema), this.spec.name);
            this.repairPendingTools();
        }

        this.opened = true;

        this.host.onEvent({
            type: 'session',
            agentSessionId: this.sessionId,
            model: this.launch.selection.model,
            effectiveRuntimeMode: this.mode,
            permissionMode: this.mode
        });
    }

    sendTurn(input: TurnInput): void {
        if (!this.opened || this.controller) {
            throw new Error(`${this.spec.name} is not ready for a new turn.`);
        }

        if (input.attachments.length || input.skills.length || input.mentions.length) {
            this.host.onEvent({
                type: 'turn.done',
                state: 'error',
                costUsd: 0,
                error: `${this.spec.name} currently accepts text and project tools. Attachments and skill chips are unavailable.`
            });

            return;
        }

        const controller = new AbortController();
        this.controller = controller;
        this.work = this.run(input, controller);
    }

    private async run(input: TurnInput, controller: AbortController): Promise<void> {
        const { name } = this.spec;
        let failure: string | undefined;

        try {
            this.messages.push({ role: 'user', content: [input.preamble, input.text].filter(Boolean).join('\n\n') });
            await this.save();
            const limits = this.spec.toolRounds();
            const rounds = limits.roundsPerRun * limits.runs;

            for (let round = 0; round < rounds; round++) {
                controller.signal.throwIfAborted();

                if (round > 0 && round % limits.roundsPerRun === 0) {
                    this.host.onEvent({ type: 'note', level: 'info', text: `Continuing after ${round} tool rounds.` });
                    this.messages.push({ role: 'user', content: CONTINUE_MESSAGE });
                    await this.save();
                }

                const answer = await this.exchange(randomUUID(), controller.signal);
                this.messages.push(answer);
                await this.save();

                if (!answer.tool_calls?.length) {
                    return;
                }

                for (const call of answer.tool_calls) {
                    const { output } = await this.tools.run(call.function.name, call.function.arguments, controller.signal);
                    this.messages.push({ role: 'tool', tool_call_id: call.id, content: output });
                    await this.save();
                }
            }

            throw new Error(`${name} reached ${rounds} tool rounds. Send another message to continue.`);
        } catch (error) {
            // Never forward fetch errors or raw remote bodies: these can contain credentials.
            failure = error instanceof Error && error.message.startsWith(name) ? error.message : this.spec.words.failed;
        } finally {
            this.repairPendingTools();

            try {
                await this.save();
            } catch {
                failure = `${name} could not save this conversation.`;
            }

            this.controller = null;
            endTurn(this.host, controller, failure);
        }
    }

    /* One request of a round, streamed into the thread under `ref`, with the tokens it spent logged before a stop can end the turn. */
    private async exchange(ref: string, signal: AbortSignal): Promise<ChatCompletionsAnswer> {
        const key = this.spec.apiKey();
        const { model } = this.launch.selection;

        if (!key) {
            throw new Error(this.spec.words.disconnected);
        }

        const response = await this.spec.request(`${this.spec.url}/chat/completions`, {
            method: 'POST',
            redirect: 'error',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
            body: JSON.stringify({
                model,
                stream: true,
                // The API sends the counts of a streamed request only when asked, and both the context meter and a usage log read them.
                stream_options: { include_usage: true },
                messages: [{ role: 'system', content: apiInstructions(this.launch) }, ...this.messages],
                ...(this.spec.supportsTools(model) ? { tools: (await this.tools.definitions()).map((tool) => ({ type: 'function', function: tool })) } : {})
            })
        });

        if (!response.ok) {
            throw this.spec.httpError(response.status);
        }

        if (!response.body) {
            throw new Error(`${this.spec.name} returned an empty response.`);
        }

        let counted: ChatCompletionsTokens | null = null;

        const answer = await readChatCompletionsStream(response.body, this.spec.name, {
            onText: (text) => this.host.onEvent({ type: 'text.delta', ref, text }),
            onThinking: (text) => this.host.onEvent({ type: 'thinking.delta', ref: `${ref}-thinking`, text }),
            onUsage: (usage) => {
                counted = usage;

                this.host.onEvent({
                    type: 'usage',
                    contextTokens: usage.prompt,
                    contextWindow: this.spec.catalog.contextWindowFor(this.launch.selection) ?? undefined
                });
            }
        });

        if (counted !== null) {
            await this.spec.onUsage?.({ model, session: this.sessionId, cwd: this.launch.cwd, ...(counted as ChatCompletionsTokens) });
        }

        signal.throwIfAborted();

        if (answer.content) {
            this.host.onEvent({ type: 'text.done', ref, text: answer.content });
        }

        if (answer.reasoning_content) {
            this.host.onEvent({ type: 'thinking.done', ref: `${ref}-thinking`, text: answer.reasoning_content });
        }

        return answer;
    }

    /* A crash may leave assistant calls without results; the ones that came stay and the rest read as interrupted. */
    private repairPendingTools(): void {
        const repaired: Message[] = [];

        for (let index = 0; index < this.messages.length; index++) {
            const message = this.messages[index]!;
            repaired.push(message);

            if (!message.tool_calls?.length) {
                continue;
            }

            const results: Message[] = [];

            while (this.messages[index + 1]?.role === 'tool') {
                results.push(this.messages[++index]!);
            }

            for (const call of message.tool_calls) {
                repaired.push(results.find((result) => result.tool_call_id === call.id) ?? { role: 'tool', tool_call_id: call.id, content: INTERRUPTED });
            }
        }

        this.messages = repaired;
    }

    private save(): Promise<void> {
        return writeThread(this.path, this.messages, this.spec.name);
    }

    compact(): void {
        throw new Error(`${this.spec.name} context compaction is unavailable. Start a new chat.`);
    }

    interrupt(): void {
        this.controller?.abort();
    }

    respondApproval(id: string, decision: ApprovalDecision): boolean {
        return this.tools.respondApproval(id, decision);
    }

    respondQuestion(id: string, answers: Record<string, string>): boolean {
        return this.tools.respondQuestion(id, answers);
    }

    declineRequest(id: string): boolean {
        return this.tools.declineRequest(id);
    }

    stop(): void {
        this.interrupt();
    }

    async dispose(): Promise<void> {
        this.interrupt();
        await this.work;
        await this.tools.close();
        this.opened = false;
        this.host.onEvent({ type: 'exit', exitCode: 0 });
    }
}

/**
 * A chat on an API that speaks OpenAI's streamed `/chat/completions`: the thread is a file of its own, the
 * project tools wait for approval as far as the runtime mode says, and a run of tool rounds is cut at `toolRounds`.
 */
export function createChatCompletionsBackend(spec: ChatCompletionsSpec): (launch: BackendLaunch, host: BackendHost) => ChatBackend {
    return (launch, host) => new ChatCompletionsBackend(launch, host, spec);
}
