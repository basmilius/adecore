import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { attachmentImageMime, type AgentKind, type ChatAttachment, type ModelSelection } from '@adecore/agent-contracts';
import { errorText } from '../error-text.ts';
import { MODE_ORDER } from '../modes.ts';
import {
    ACP_AUTH_REQUIRED,
    ACP_PROTOCOL_VERSION,
    AcpProtocol,
    acpErrorLimit,
    acpStopWords,
    autoAllows,
    GROK_QUESTION_METHODS,
    parseInitialize,
    parseSessionInfo,
    promptUsageOf,
    resolveAcpMode,
    runtimeModeOf,
    sessionIdOf,
    sessionUpdateOf,
    thoughtLevelOf,
    type AcpAgentCapabilities,
    type AcpModeMap,
    type AcpPermissionRequest,
    type AcpQuestion,
    type AcpSessionInfo,
    type AcpThoughtLevel,
    type AcpTurnUsage
} from './acp-protocol.ts';
import type { ApprovalDecision, BackendEvent, BackendHost, BackendLaunch, ChatBackend, TurnInput } from './backend.ts';
import { attachmentNote } from './input.ts';
import { JsonRpcError, JsonRpcTransport, type JsonRpcFrame } from './json-rpc-transport.ts';

/* How the host names itself in `initialize`. */
export interface AcpClientInfo {
    name: string;
    title?: string;
    version: string;
}

export const DEFAULT_ACP_CLIENT: AcpClientInfo = { name: 'agents', title: 'Agents', version: '0.1.0' };

/* One agent that speaks ACP over its stdio, as the backend needs to know it. */
export interface AcpAgentSpec {
    // The agent as a person reads it, in the notes and errors the backend writes.
    name: string;
    // Which agent this is, for an error code only that agent gives a meaning; absent reads none of them.
    kind?: AgentKind;
    // Variables set over the launch's environment.
    env?: Record<string, string>;
    // The agent's own mode ids per runtime mode, best first. A runtime mode the agent has no id for runs in
    // the next narrower one it has, and the backend answers the rest of what the runtime mode allows itself.
    modes?: AcpModeMap;
    // The auth method passed to `authenticate` when the agent answers a session request with "authentication
    // required"; absent or null fails the start with `loginHint` instead.
    authMethod?: string | null;
    // What a person does to sign the agent in, for the error a start without a login fails with.
    loginHint?: string;
    client?: AcpClientInfo;
    // The agent's model id for a selection; null leaves the agent's own choice. Absent takes the selection's model as it is.
    model?(selection: ModelSelection): string | null;
    // What every new, loaded or resumed session offers, for a host that fills its model catalog from the agent.
    onSession?(info: AcpSessionInfo): void;
    // The tokens of every turn whose `session/prompt` response reports them, for a host that keeps a usage log.
    onUsage?(usage: AcpUsageReport): void;
    // Called once per process, at the first `usage_update` that names the context window.
    onContextReport?(): void;
    // The slash commands a session offers (without the slash), each time the agent lists them.
    onCommands?(commands: string[]): void;
    // True takes the session titles the agent sends (`session_info_update`) as the chat's suggested title. Absent leaves
    // naming the chat to the host, since an agent may rename the session after every turn.
    adoptTitles?: boolean;
    // A permission request the host answers itself, in any runtime mode: true allows it once without asking the
    // person, for a call the host already guards. A throw counts as false.
    autoAllow?(request: AcpPermissionRequest): boolean;
}

/* One turn's usage, with the session, folder and model it ran in. */
export interface AcpUsageReport extends AcpTurnUsage {
    sessionId: string;
    cwd: string;
    model: string;
}

// What `initialize` and a session request may take; a prompt and a login wait for as long as the agent runs.
const REQUEST_TIMEOUT_MS = 60_000;

// What a prompt carries of mentioned files; a larger file stays a path the agent opens with its own tools.
const MAX_EMBEDDED_FILE_BYTES = 256 * 1024;
const MAX_EMBEDDED_BYTES = 1024 * 1024;

function inside(folder: string, path: string): boolean {
    const rest = relative(folder, path);

    return rest === '' || (!rest.startsWith('..') && !isAbsolute(rest));
}

function nameOf(client: AcpClientInfo): string {
    return client.title ?? client.name;
}

/*
 * One ACP agent process on JSON-RPC over stdio. `start` runs `initialize` and opens the session
 * (new, or the chat's own resumed or loaded), sets the mode and the model, and only then takes a turn.
 * A turn is one `session/prompt` request and ends on its response. The client advertises no file
 * system and no terminal, so the agent works with its own tools.
 */
export class AcpBackend implements ChatBackend {
    private readonly launch: BackendLaunch;
    private readonly host: BackendHost;
    private readonly spec: AcpAgentSpec;
    private readonly client: AcpClientInfo;
    private readonly protocol: AcpProtocol;
    private transport: JsonRpcTransport | null = null;
    private capabilities: AcpAgentCapabilities | null = null;
    private sessionId = '';
    // A loaded session replays its history as updates the thread already holds.
    private replaying = false;
    private contextPending: string | null = null;
    private prompt: { promptId: string | undefined; cancelled: boolean } | null = null;
    private model: string | null = null;
    private contextReported = false;
    private commands: string[] = [];
    // An agent may send updates for a new session before it answers with the session's id.
    private early: unknown[] = [];

    constructor(launch: BackendLaunch, host: BackendHost, spec: AcpAgentSpec) {
        this.launch = launch;
        this.host = host;
        this.spec = spec;
        this.client = spec.client ?? DEFAULT_ACP_CLIENT;
        this.protocol = new AcpProtocol(launch.generation, spec.modes ?? {}, acpStopWords(spec.name), spec.adoptTitles === true, launch.now);
    }

    get running(): boolean {
        return this.transport !== null;
    }

    get pid(): number | null {
        return this.transport?.pid ?? null;
    }

    async start(): Promise<void> {
        if (this.transport) {
            return;
        }

        const transport = new JsonRpcTransport({
            command: this.launch.command,
            cwd: this.launch.cwd,
            env: { ...this.launch.env, ...this.spec.env },
            ...(this.launch.spawn ? { spawn: this.launch.spawn } : {}),
            label: this.spec.name,
            errorName: 'AcpRpcError',
            requestTimeoutMs: REQUEST_TIMEOUT_MS,
            versionField: true,
            onError: (error) => this.fail(error),
            onFrame: (frame) => this.handleFrame(transport, frame),
            onExit: (exitCode, stderr) => this.handleExit(transport, exitCode, stderr)
        });

        this.transport = transport;

        try {
            await this.handshake(transport);
        } catch (error) {
            // A chat that failed to start drops this backend, so nothing else would end an agent stuck in its handshake.
            if (this.transport === transport) {
                this.transport = null;
                void transport.dispose();
            }

            throw error;
        }
    }

    private async handshake(transport: JsonRpcTransport): Promise<void> {
        const capabilities = parseInitialize(
            await transport.request('initialize', {
                protocolVersion: ACP_PROTOCOL_VERSION,
                clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
                clientInfo: { name: this.client.name, title: nameOf(this.client), version: this.client.version }
            })
        );

        if (capabilities.protocolVersion !== ACP_PROTOCOL_VERSION) {
            throw new Error(`${this.spec.name} speaks ACP version ${capabilities.protocolVersion}; only version ${ACP_PROTOCOL_VERSION} is supported`);
        }

        this.capabilities = capabilities;
        const info = await this.openSession(transport, capabilities);
        const modeId = await this.applyMode(transport, info);
        const { model, thoughtLevel } = await this.applyModel(transport, info);
        this.model = model;
        await this.applyThoughtLevel(transport, thoughtLevel);
        this.spec.onSession?.(info);

        this.emit({
            type: 'session',
            agentSessionId: this.sessionId,
            model,
            effectiveRuntimeMode: this.launch.runtimeMode,
            ...(modeId === null ? {} : { permissionMode: modeId })
        });

        for (const params of this.early.splice(0)) {
            this.emitAll(this.protocol.update(this.sessionId, params));
        }
    }

    private sessionParams(): Record<string, unknown> {
        const folders = this.launch.folders ?? [];

        return {
            cwd: this.launch.cwd,
            mcpServers: [],
            ...(folders.length > 0 && this.capabilities?.additionalDirectories ? { additionalDirectories: folders } : {})
        };
    }

    private async openSession(transport: JsonRpcTransport, capabilities: AcpAgentCapabilities): Promise<AcpSessionInfo> {
        const resume = this.launch.resume;

        if (resume) {
            const method = capabilities.resumeSession ? 'session/resume' : capabilities.loadSession ? 'session/load' : null;

            if (method === null) {
                this.emit({ type: 'note', level: 'warning', text: `${this.spec.name} cannot continue a session it ran before. Started a new one.` });
            } else {
                try {
                    this.replaying = method === 'session/load';
                    const result = await this.authenticated(transport, method, { sessionId: resume, ...this.sessionParams() });
                    this.sessionId = resume;
                    this.contextPending = [this.launch.resumeInstructions ?? null, this.launch.resumeNote].filter((part) => part !== null).join('\n\n') || null;

                    return parseSessionInfo(result, resume, capabilities.agent);
                } catch (error) {
                    // A refusal means the agent no longer has the session and a fresh one keeps the chat usable; a silence or an exit says nothing about it.
                    if (!(error instanceof JsonRpcError)) {
                        throw error;
                    }

                    this.emit({
                        type: 'note',
                        level: 'warning',
                        text: `${this.spec.name} could not continue its session (${errorText(error)}). Started a new one.`
                    });
                } finally {
                    this.replaying = false;
                }
            }
        }

        const result = await this.authenticated(transport, 'session/new', this.sessionParams());
        const sessionId = sessionIdOf(result);

        if (sessionId === null) {
            throw new Error(`session/new failed: ${this.spec.name} answered without a session id`);
        }

        this.sessionId = sessionId;
        this.contextPending = this.launch.instructions;

        return parseSessionInfo(result, sessionId, capabilities.agent);
    }

    /* A session request, once more after `authenticate` when the agent says it needs a login first. */
    private async authenticated(transport: JsonRpcTransport, method: string, params: unknown): Promise<unknown> {
        try {
            return await transport.request(method, params);
        } catch (error) {
            if (!(error instanceof JsonRpcError) || error.code !== ACP_AUTH_REQUIRED) {
                throw error;
            }

            const methodId = this.spec.authMethod ?? null;
            const offered = this.capabilities?.authMethods ?? [];

            if (methodId === null || (offered.length > 0 && !offered.includes(methodId))) {
                throw new Error(`${this.spec.name} is not signed in.${this.spec.loginHint ? ` ${this.spec.loginHint}` : ''}`, { cause: error });
            }

            await transport.request('authenticate', { methodId }, { timeoutMs: null });

            return transport.request(method, params);
        }
    }

    /* Puts the session in the agent mode the runtime mode maps to; answers the mode it runs in, or null for an agent without modes. */
    private async applyMode(transport: JsonRpcTransport, info: AcpSessionInfo): Promise<string | null> {
        const modes = info.modes;

        if (modes === null || modes.modes.length === 0) {
            return null;
        }

        const map = this.spec.modes ?? {};
        const requested = this.launch.runtimeMode;

        const resolved = resolveAcpMode(
            requested,
            map,
            modes.modes.map((mode) => mode.id)
        );

        if (resolved === null) {
            const current = runtimeModeOf(modes.current, map);

            if (current !== null && MODE_ORDER.indexOf(current) > MODE_ORDER.indexOf(requested)) {
                throw new Error(`${this.spec.name} runs in ${modes.current}, which allows more than ${requested}, and offers no narrower mode`);
            }

            return modes.current;
        }

        if (resolved.modeId === modes.current) {
            return modes.current;
        }

        if (modes.configId === null) {
            await transport.request('session/set_mode', { sessionId: this.sessionId, modeId: resolved.modeId });
        } else {
            await transport.request('session/set_config_option', { sessionId: this.sessionId, configId: modes.configId, value: resolved.modeId });
        }

        return resolved.modeId;
    }

    /*
     * Switches to the selected model where the agent offers it; answers the model the session runs and the
     * reasoning effort it offers there, which may change with the model.
     */
    private async applyModel(transport: JsonRpcTransport, info: AcpSessionInfo): Promise<{ model: string | null; thoughtLevel: AcpThoughtLevel | null }> {
        const models = info.models;
        const thoughtLevel = info.thoughtLevel;
        const wanted = this.spec.model ? this.spec.model(this.launch.selection) : this.launch.selection.model;

        if (models === null || wanted === null || wanted === models.current) {
            return { model: models?.current ?? wanted, thoughtLevel };
        }

        if (!models.models.some((model) => model.id === wanted)) {
            this.emit({ type: 'note', level: 'warning', text: `${this.spec.name} does not offer ${this.launch.modelName}. It runs ${models.current}.` });

            return { model: models.current, thoughtLevel };
        }

        try {
            if (models.configId === null) {
                await transport.request('session/set_model', { sessionId: this.sessionId, modelId: wanted });

                return { model: wanted, thoughtLevel };
            }

            const result = await transport.request('session/set_config_option', { sessionId: this.sessionId, configId: models.configId, value: wanted });
            const after = thoughtLevelOf(result);

            return { model: wanted, thoughtLevel: after === undefined ? thoughtLevel : after };
        } catch (error) {
            if (!(error instanceof JsonRpcError)) {
                throw error;
            }

            this.emit({
                type: 'note',
                level: 'warning',
                text: `${this.spec.name} did not switch to ${this.launch.modelName} (${errorText(error)}). It runs ${models.current}.`
            });

            return { model: models.current, thoughtLevel };
        }
    }

    /* Sets the selected effort where the session offers it; a model without one runs as it is. */
    private async applyThoughtLevel(transport: JsonRpcTransport, level: AcpThoughtLevel | null): Promise<void> {
        const effort = this.launch.selection.options.effort;
        const choice = level?.choices.find((entry) => entry.id === effort);

        if (level === null || choice === undefined || effort === level.current) {
            return;
        }

        try {
            await transport.request('session/set_config_option', { sessionId: this.sessionId, configId: level.configId, value: choice.id });
        } catch (error) {
            if (!(error instanceof JsonRpcError)) {
                throw error;
            }

            const current = level.choices.find((entry) => entry.id === level.current)?.name ?? level.current;
            this.emit({ type: 'note', level: 'warning', text: `${this.spec.name} kept its reasoning at ${current} instead of ${choice.name}.` });
        }
    }

    private promptBlocks(input: TurnInput): unknown[] {
        const sendsImages = this.capabilities?.images === true;
        const images = sendsImages ? input.attachments.filter((attachment) => attachmentImageMime(attachment) !== null) : [];

        const blocks = images.map((attachment) => {
            let data: string;

            try {
                data = readFileSync(attachment.path).toString('base64');
            } catch {
                throw new Error(`Could not read attached image "${attachment.name}". Attach it again and retry.`);
            }

            return { type: 'image', mimeType: attachmentImageMime(attachment), data };
        });

        const named: ChatAttachment[] = input.attachments.filter((attachment) => !images.includes(attachment));
        const parts = [this.contextPending, input.preamble, input.text, attachmentNote(named)].filter((part): part is string => part !== null && part !== '');
        this.contextPending = null;
        const text = parts.join('\n\n');
        this.protocol.prompted(text);

        return [{ type: 'text', text }, ...blocks, ...this.mentionBlocks(input.mentions)];
    }

    /*
     * The text of each mentioned file as a `resource` block, for an agent that takes embedded context. Only a text file
     * inside the chat's folders goes along, since a mention is a path anyone who may send could name; the rest stays
     * in the prompt as the path it is.
     */
    private mentionBlocks(mentions: readonly string[]): unknown[] {
        if (this.capabilities?.embeddedContext !== true || mentions.length === 0) {
            return [];
        }

        const real = (path: string): string | null => {
            try {
                return realpathSync(path);
            } catch {
                return null;
            }
        };

        const folders = [this.launch.cwd, ...(this.launch.folders ?? [])].flatMap((folder) => real(folder) ?? []);
        const blocks: unknown[] = [];
        let budget = MAX_EMBEDDED_BYTES;

        for (const mention of new Set(mentions)) {
            const path = real(resolve(this.launch.cwd, mention));

            if (path === null || !folders.some((folder) => inside(folder, path))) {
                continue;
            }

            let text: string;

            try {
                const stat = statSync(path);

                if (!stat.isFile() || stat.size > MAX_EMBEDDED_FILE_BYTES || stat.size > budget) {
                    continue;
                }

                text = readFileSync(path, 'utf8');
            } catch {
                continue;
            }

            if (text.includes('\u0000')) {
                continue;
            }

            budget -= Buffer.byteLength(text);
            blocks.push({ type: 'resource', resource: { uri: pathToFileURL(path).href, text } });
        }

        return blocks;
    }

    sendTurn(input: TurnInput): void {
        const transport = this.transport;

        if (!transport) {
            this.emit({ type: 'failed', message: `${this.spec.name} is not running` });

            return;
        }

        const prompt = this.promptBlocks(input);
        const turn = { promptId: input.promptId, cancelled: false };
        this.prompt = turn;

        transport
            .request('session/prompt', { sessionId: this.sessionId, prompt }, { timeoutMs: null })
            .then((result) => {
                if (this.transport === transport && this.prompt === turn) {
                    this.prompt = null;
                    this.report(result);
                    this.emitAll(this.protocol.finish(result, turn.promptId, turn.cancelled));
                }
            })
            .catch((error: unknown) => {
                // A process that went has its exit tell the thread; anything else ends this turn alone.
                if (this.transport === transport && transport.alive && this.prompt === turn) {
                    this.prompt = null;
                    const limit = error instanceof JsonRpcError ? acpErrorLimit(error.code, error.data, this.spec.kind ?? null) : null;
                    this.emitAll(this.protocol.abort(turn.promptId, turn.cancelled ? null : errorText(error), limit));
                }
            });
    }

    /* ACP has no call to fold the context, so an agent that lists a `compact` command gets it as a prompt. */
    compact(): void {
        if (this.commands.includes('compact')) {
            this.sendTurn({ text: '/compact', preamble: null, attachments: [], mentions: [], skills: [] });

            return;
        }

        this.emit({ type: 'note', level: 'warning', text: `${this.spec.name} cannot compact its context.` });
        this.emit({ type: 'turn.done', state: 'done', costUsd: 0 });
    }

    /* Cancels the turn: every permission request still open is answered as cancelled, and the turn ends on the prompt's response. */
    interrupt(): void {
        const transport = this.transport;

        if (!transport) {
            return;
        }

        if (this.prompt === null) {
            this.emit({ type: 'turn.done', state: 'aborted', costUsd: 0 });

            return;
        }

        this.prompt.cancelled = true;

        try {
            for (const cancelled of this.protocol.cancelRequests()) {
                transport.respond(cancelled.rpcId, cancelled.result);
                this.emit({ type: 'request.withdrawn', requestId: cancelled.requestId });
            }

            transport.notify('session/cancel', { sessionId: this.sessionId });
        } catch (error) {
            this.fail(error);
        }
    }

    respondApproval(requestId: string, decision: ApprovalDecision): boolean {
        const answer = this.protocol.answer(requestId, decision);

        if (!answer) {
            return false;
        }

        if (!this.respond(requestId, answer.rpcId, answer.result)) {
            return false;
        }

        this.emitAll(answer.events);

        return true;
    }

    respondQuestion(requestId: string, answers: Record<string, string>): boolean {
        const answer = this.protocol.answerQuestion(requestId, answers);

        if (!answer) {
            return false;
        }

        if (!this.respond(requestId, answer.rpcId, answer.result)) {
            return false;
        }

        this.emitAll(answer.events);

        return true;
    }

    declineRequest(requestId: string): boolean {
        if (this.protocol.hasQuestion(requestId)) {
            const cancelled = this.protocol.cancelQuestion(requestId);

            return cancelled !== null && this.respond(requestId, cancelled.rpcId, cancelled.result);
        }

        return this.protocol.hasPermission(requestId) && this.respondApproval(requestId, 'deny');
    }

    stop(): void {
        this.transport?.stop();
    }

    dispose(): Promise<void> {
        const transport = this.transport;
        this.transport = null;

        return transport?.dispose() ?? Promise.resolve();
    }

    private respond(requestId: string, rpcId: number | string, result: unknown): boolean {
        try {
            if (!this.transport) {
                throw new Error(`${this.spec.name} is not running`);
            }

            this.transport.respond(rpcId, result);

            return true;
        } catch (error) {
            this.emit({ type: 'request.withdrawn', requestId });
            this.fail(error);

            return false;
        }
    }

    private fail(error: unknown): void {
        this.emit({ type: 'failed', message: errorText(error), processAlive: this.running });
    }

    private handleFrame(transport: JsonRpcTransport, frame: JsonRpcFrame): void {
        if (this.transport !== transport) {
            return;
        }

        const id = typeof frame.id === 'number' || typeof frame.id === 'string' ? frame.id : null;

        if (frame.method === 'session/update' && id === null) {
            if (this.sessionId === '' || this.replaying) {
                this.holdEarly(frame.params);

                return;
            }

            this.emitAll(this.protocol.update(this.sessionId, frame.params));

            return;
        }

        if (id === null) {
            return;
        }

        if (typeof frame.method === 'string' && GROK_QUESTION_METHODS.includes(frame.method)) {
            const question = this.protocol.question(id, this.sessionId, frame.params);

            if (question === null) {
                transport.respondError(id, -32602, 'Not a question of this session');

                return;
            }

            this.ask(transport, question);

            return;
        }

        if (frame.method !== 'session/request_permission') {
            transport.respondError(id, -32601, `${nameOf(this.client)} does not handle ${String(frame.method)}`);

            return;
        }

        // Before any runtime mode answers it: a question is never the agent's to allow.
        const interaction = this.protocol.interaction(id, this.sessionId, frame.params);

        if (interaction !== null) {
            this.ask(transport, interaction);

            return;
        }

        const permission = this.protocol.permission(id, this.sessionId, frame.params);

        if (permission === null) {
            transport.respondError(id, -32602, 'Not a permission request of this session');

            return;
        }

        if (this.prompt?.cancelled) {
            this.emitAll(permission.events.filter((event) => event.type !== 'approval.requested'));
            const answer = this.protocol.cancelRequests().find((cancelled) => cancelled.requestId === permission.requestId);

            if (answer) {
                transport.respond(answer.rpcId, answer.result);
            }

            return;
        }

        if (autoAllows(this.launch.runtimeMode, permission.kind) || this.hostAllows(permission.request)) {
            this.emitAll(permission.events.filter((event) => event.type !== 'approval.requested'));
            const answer = this.protocol.answer(permission.requestId, 'allow');

            if (answer) {
                this.respond(permission.requestId, answer.rpcId, answer.result);
            }

            return;
        }

        this.emitAll(permission.events);
    }

    /* Puts a question to the person, or turns it down at once when the turn is being cancelled. */
    private ask(transport: JsonRpcTransport, question: AcpQuestion): void {
        if (this.prompt?.cancelled) {
            this.emitAll(question.events.filter((event) => event.type !== 'question.requested'));
            const cancelled = this.protocol.cancelQuestion(question.requestId);

            if (cancelled) {
                transport.respond(cancelled.rpcId, cancelled.result);
            }

            return;
        }

        this.emitAll(question.events);
    }

    /* Holds an update until the session is known; of a history a load replays, only the commands, since the thread has the rest. */
    private holdEarly(params: unknown): void {
        const update = sessionUpdateOf(params);

        if (update !== null && (!this.replaying || update.commands !== null)) {
            this.early.push(params);
        }
    }

    private hostAllows(request: AcpPermissionRequest): boolean {
        try {
            return this.spec.autoAllow?.(request) === true;
        } catch {
            return false;
        }
    }

    private handleExit(transport: JsonRpcTransport, exitCode: number | null, stderr: string | null): void {
        if (this.transport !== transport) {
            return;
        }

        this.transport = null;
        this.prompt = null;
        this.protocol.cancelRequests();
        this.emit({ type: 'exit', exitCode, ...(stderr === null ? {} : { stderr }) });
    }

    /* A cancelled turn still spent what it reports. A host that fails to keep it costs the record, never the end of the turn. */
    private report(result: unknown): void {
        const usage = this.spec.onUsage === undefined ? null : promptUsageOf(result);

        if (usage === null) {
            return;
        }

        try {
            this.spec.onUsage?.({ ...usage, sessionId: this.sessionId, cwd: this.launch.cwd, model: this.model ?? this.launch.selection.model });
        } catch (error) {
            console.warn(`Could not keep the usage of a ${this.spec.name} turn:`, errorText(error));
        }
    }

    private emitAll(events: BackendEvent[]): void {
        for (const event of events) {
            this.emit(event);
        }
    }

    private emit(event: BackendEvent): void {
        if (event.type === 'model') {
            this.model = event.model;
        }

        if (event.type === 'session' && event.slashCommands !== undefined) {
            this.commands = event.slashCommands;
            this.spec.onCommands?.(event.slashCommands);
        }

        if (event.type === 'usage' && event.contextWindow !== undefined && !this.contextReported) {
            this.contextReported = true;
            this.spec.onContextReport?.();
        }

        this.host.onEvent(event);
    }
}

/* The `createBackend` of a provider whose agent speaks ACP. */
export function createAcpBackend(spec: AcpAgentSpec): (launch: BackendLaunch, host: BackendHost) => ChatBackend {
    return (launch, host) => new AcpBackend(launch, host, spec);
}
