import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type {
    CanUseTool,
    EffortLevel,
    McpServerConfig,
    Options,
    PermissionMode,
    PermissionResult,
    Query,
    SDKMessage,
    SDKUserMessage,
    SpawnedProcess,
    SpawnOptions
} from '@anthropic-ai/claude-agent-sdk';
import { isRecord, type ModelSelection, type RuntimeMode } from '@adecore/agent-contracts';
import { errorText } from '../error-text.ts';
import { claudeEffort, claudeEnv, claudeModel, claudePermissionMode, claudeSettings, promptPrefix } from '../providers/claude.ts';
import type { ApprovalDecision, BackendChange, BackendEvent, BackendHost, BackendLaunch, ChatBackend, ChatMcpServer, TurnInput } from './backend.ts';
import { ChatChild } from './chat-process.ts';
import { ClaudeProtocol } from './claude-protocol.ts';
import { buildUserMessage } from './input.ts';
import { asError } from '@adecore/utils/errors';

// How long the messages of a CLI that exited may still take through the SDK.
const EXIT_DRAIN_MS = 500;

function settleAfter(ms: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        timer.unref?.();
    });
}

// Claude may echo a steer only once a slow tool returns, so a running turn sets no deadline; after the turn ended, a message
// it still holds opens the next turn at once or never arrives.
const STEER_GRACE_MS = 30_000;

/*
 * What `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` turns off, one by one: that variable also stops the CLI from naming
 * the session (no `ai-title` in the transcript, measured on Claude Code 2.1.317), and the chat takes its title from there.
 */
const NO_NONESSENTIAL_TRAFFIC = { DISABLE_AUTOUPDATER: '1', DISABLE_BUG_COMMAND: '1', DISABLE_ERROR_REPORTING: '1', DISABLE_TELEMETRY: '1' };

/*
 * A chat on an API key takes nothing from the host's environment that moves where the CLI sends the key and the prompts,
 * or signs it in another way: every `ANTHROPIC_*` variable (the base URLs of the API, Bedrock, Vertex and Foundry, an auth
 * token, custom headers, a Foundry key), the switches to another cloud and their auth skips, and the other sign-ins.
 * The AWS and Google variables stay: without a switch the CLI reads them for nothing, and the agent's own tools may.
 */
function movesTheKey(name: string): boolean {
    return (
        name.startsWith('ANTHROPIC_') ||
        /^CLAUDE_CODE_USE_[A-Z]+$/.test(name) ||
        /^CLAUDE_CODE_SKIP_[A-Z]+_AUTH$/.test(name) ||
        name === 'CLAUDE_CODE_OAUTH_TOKEN' ||
        name === 'AWS_BEARER_TOKEN_BEDROCK'
    );
}

/* Chats on an Anthropic API key instead of the person's own sign-in. */
export interface ClaudeApiKeyOptions {
    // Read at every start, so a key the person replaces reaches the next process.
    key(): string | Promise<string>;
    // A configuration folder of its own (`CLAUDE_CONFIG_DIR`), so the person's sign-in, settings and sessions stay out.
    configDir: string;
}

export interface ClaudeBackendOptions {
    // Tools the CLI runs without asking, in every mode, as `--allowedTools` patterns (`Bash(git status)`).
    allowedTools?: readonly string[];
    // Loads no settings file, only the launch's MCP servers, and sends no traffic beyond the model's own.
    apiKey?: ClaudeApiKeyOptions;
    // How the CLI names the host that runs it (`CLAUDE_CODE_ENTRYPOINT`); absent leaves the SDK's `sdk-ts`.
    entrypoint?: string;
}

type PermissionOptions = Parameters<CanUseTool>[2];

/*
 * The SDK's query object answers `cancelAsyncMessage(uuid)` without declaring it (0.3.317), and it is the only way to
 * withdraw one message the CLI has not taken in. Feature-tested on the object, so a runtime without it falls back to
 * letting the steer run.
 */
function steerWithdrawal(query: Query): ((uuid: string) => Promise<boolean>) | null {
    const cancel: unknown = Reflect.get(query, 'cancelAsyncMessage');

    if (typeof cancel !== 'function') {
        return null;
    }

    return async (uuid) => (await (cancel as (uuid: string) => Promise<unknown>).call(query, uuid)) === true;
}

/* A chat's messages in the order they were sent, as the SDK's streaming input; it ends once closed. */
class MessageQueue implements AsyncIterable<SDKUserMessage> {
    private readonly messages: SDKUserMessage[] = [];
    private wake: (() => void) | null = null;
    private closed = false;

    get open(): boolean {
        return !this.closed;
    }

    push(message: SDKUserMessage): void {
        this.messages.push(message);
        this.nudge();
    }

    close(): void {
        this.closed = true;
        this.nudge();
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
        while (true) {
            const message = this.messages.shift();

            if (message !== undefined) {
                yield message;

                continue;
            }

            if (this.closed) {
                return;
            }

            await new Promise<void>((resolve) => {
                this.wake = resolve;
            });
        }
    }

    private nudge(): void {
        const wake = this.wake;
        this.wake = null;
        wake?.();
    }
}

/* What the SDK puts after the executable. A script it would run through a runtime comes first there, and the launch command names it already. */
function cliArgs(options: SpawnOptions, executable: string): string[] {
    if (options.command === executable) {
        return options.args;
    }

    const at = options.args.indexOf(executable);

    return at === -1 ? options.args : options.args.slice(at + 1);
}

function definedEnv(env: SpawnOptions['env']): Record<string, string> {
    return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

// The headers go into `--mcp-config` as written, so a `${VAR}` in them is expanded by the CLI and never lands on a command line.
function mcpConfig(server: ChatMcpServer): McpServerConfig {
    const headers = server.headers ? { headers: { ...server.headers } } : {};

    return server.transport === 'sse' ? { type: 'sse', url: server.url, ...headers } : { type: 'http', url: server.url, ...headers };
}

/* The answer inside the `control_response` the protocol built; the SDK writes the envelope itself. */
function permissionResult(frame: unknown): PermissionResult {
    const response = isRecord(frame) && isRecord(frame.response) ? frame.response.response : null;

    if (!isRecord(response) || (response.behavior !== 'allow' && response.behavior !== 'deny')) {
        throw new Error('The protocol built no permission answer');
    }

    return response as PermissionResult;
}

/*
 * Claude Code driven through the Claude Agent SDK. The CLI is the person's own: the SDK starts the launch
 * command through `launch.spawn`, never the binary it bundles. The process
 * stays alive between turns; the session starts a new backend with a resume when it needs one, which is
 * also how a changed model takes effect. The SDK's messages are the CLI's frames, so `ClaudeProtocol`
 * reads them, and a permission request reaches it as the `can_use_tool` frame the SDK answered through `canUseTool`.
 */
export class ClaudeBackend implements ChatBackend {
    readonly acknowledgesTurns = true;
    private readonly launch: BackendLaunch;
    private readonly host: BackendHost;
    private readonly options: ClaudeBackendOptions;
    private readonly protocol: ClaudeProtocol;
    private query: Query | null = null;
    private input: MessageQueue | null = null;
    private child: ChatChild | null = null;
    private childExited = false;
    private pumping: Promise<void> = Promise.resolve();
    private inputBroken = false;
    // The person asked to stop; the result frame that follows closes the turn as aborted.
    private interrupted = false;
    private readonly steers = new Map<string, { resolve(accepted: boolean): void; reject(reason: Error): void }>();
    private steerTimer: ReturnType<typeof setTimeout> | null = null;
    private active = false;
    // Permission requests the CLI waits on, by its own request id; settling one hands the SDK its answer.
    private readonly permissions = new Map<string, (result: PermissionResult) => void>();
    // Moves on with every stop and dispose, so a start still waiting finds out it was let go.
    private generation = 0;
    // What the process runs on now, which `reconfigure` moves on from the launch.
    private selection: ModelSelection;
    private runtimeMode: RuntimeMode;

    constructor(launch: BackendLaunch, host: BackendHost, options: ClaudeBackendOptions = {}) {
        this.launch = launch;
        this.host = host;
        this.options = options;
        this.selection = launch.selection;
        this.runtimeMode = launch.runtimeMode;
        this.protocol = new ClaudeProtocol(launch.goal ?? null, launch.now, launch.cacheTtlMs ?? null);
    }

    get running(): boolean {
        return this.query !== null;
    }

    get pid(): number | null {
        return this.child?.pid ?? null;
    }

    async start(): Promise<void> {
        if (this.query) {
            return;
        }

        const executable = this.launch.command[0];

        if (executable === undefined) {
            throw new Error('No command to start');
        }

        // A stop or a dispose while this waits means the session let go of the backend; nothing may start after it.
        const generation = this.generation;
        const key = this.options.apiKey ? await this.options.apiKey.key() : null;

        if (generation !== this.generation) {
            return;
        }

        const options = this.queryOptions(executable, key);
        // Loaded on the first start: a large module that only a chat that runs needs.
        const { query } = await import('@anthropic-ai/claude-agent-sdk');

        if (this.query || generation !== this.generation) {
            return;
        }

        const input = new MessageQueue();
        this.input = input;
        this.inputBroken = false;
        const running = query({ prompt: input, options });
        this.query = running;
        this.pumping = this.pump(running);
    }

    sendTurn(input: TurnInput): void {
        const promptId = input.promptId ?? randomUUID();
        this.active = true;
        this.protocol.beginPrompt(promptId);
        this.push(this.userMessage(input, promptId));
    }

    steerTurn(input: TurnInput): Promise<boolean> {
        if (!this.query || !this.active || this.inputBroken) {
            return Promise.resolve(false);
        }

        const promptId = input.promptId ?? randomUUID();

        return new Promise((resolve, reject) => {
            this.steers.set(promptId, { resolve, reject });
            this.protocol.beginSteer(promptId);

            try {
                this.push(this.userMessage(input, promptId));
            } catch (error) {
                this.steers.delete(promptId);
                reject(asError(error));
            }
        });
    }

    /* Claude Code folds its context through a slash command, so the session sends it as a turn. */
    compact(): void {
        this.sendTurn({ text: '/compact', preamble: null, attachments: [], mentions: [], skills: [] });
    }

    interrupt(): void {
        const running = this.requireQuery();
        this.interrupted = true;
        this.protocol.noteInterrupt();

        const fail = (error: unknown): void => {
            if (this.query === running) {
                this.failed(error);
            }
        };

        void running.interrupt().catch(fail);
        // A steer the CLI has not taken in survives a plain interrupt and would run after the Stop; it goes back to the queue
        // instead. Without the call it does run, and its echo settles it.
        const withdraw = steerWithdrawal(running);

        if (withdraw === null) {
            return;
        }

        for (const promptId of [...this.steers.keys()]) {
            // One the CLI no longer held (already taken in) still waits for its echo.
            void withdraw(promptId).then((cancelled) => {
                if (cancelled) {
                    this.settleSteer(promptId, false);
                }
            }, fail);
        }
    }

    stopTask(taskId: string): void {
        const running = this.requireQuery();

        void running.stopTask(taskId).catch((error: unknown) => {
            if (this.query === running) {
                this.dispatch([{ type: 'stop.refused', taskId, message: errorText(error) }]);
            }
        });
    }

    respondApproval(requestId: string, decision: ApprovalDecision, message?: string): boolean {
        return this.answer(requestId, this.protocol.approvalResponse(requestId, decision, message));
    }

    respondQuestion(requestId: string, answers: Record<string, string>): boolean {
        return this.answer(requestId, this.protocol.questionResponse(requestId, answers));
    }

    declineRequest(requestId: string, message: string): boolean {
        return this.answer(requestId, this.protocol.declineResponse(requestId, message));
    }

    /*
     * Model, effort, fast mode and permission mode change in the running CLI. What it only reads at its start needs a
     * new process: a context window that moves `CLAUDE_CODE_AUTO_COMPACT_WINDOW` or auto-compact, and bypassing
     * permissions in a process started without `--allow-dangerously-skip-permissions`.
     */
    async reconfigure(change: BackendChange): Promise<boolean> {
        const running = this.query;

        if (running === null || this.inputBroken) {
            return false;
        }

        const from = this.selection;
        const to = change.selection;
        const startsOnly =
            JSON.stringify(claudeEnv(from)) !== JSON.stringify(claudeEnv(to)) ||
            claudeSettings(from)?.autoCompactEnabled !== claudeSettings(to)?.autoCompactEnabled;
        const bypass =
            claudePermissionMode(change.runtimeMode) === 'bypassPermissions' && claudePermissionMode(this.launch.runtimeMode) !== 'bypassPermissions';

        if (startsOnly || bypass) {
            return false;
        }

        try {
            if (claudeModel(from) !== claudeModel(to)) {
                await running.setModel(claudeModel(to));
            }

            const flags = {
                ...(claudeEffort(from) === claudeEffort(to) ? {} : { effortLevel: claudeEffort(to) as EffortLevel | null }),
                ...((claudeSettings(from)?.fastMode ?? false) === (claudeSettings(to)?.fastMode ?? false)
                    ? {}
                    : { fastMode: claudeSettings(to)?.fastMode ?? null })
            };

            if (Object.keys(flags).length > 0) {
                await running.applyFlagSettings(flags);
            }

            if (change.runtimeMode !== this.runtimeMode) {
                await running.setPermissionMode((claudePermissionMode(change.runtimeMode) ?? 'default') as PermissionMode);
            }
        } catch {
            // Part of it may have taken; a new process takes all of it.
            return false;
        }

        if (this.query !== running) {
            return false;
        }

        this.selection = to;
        this.runtimeMode = change.runtimeMode;

        return true;
    }

    stop(): void {
        this.generation += 1;
        this.input?.close();
        this.child?.endAfterGrace();
    }

    dispose(): Promise<void> {
        this.generation += 1;
        this.rejectSteers('Claude stopped before acknowledging your message');
        const child = this.child;
        const running = this.query;
        this.child = null;
        this.query = null;
        this.denyPermissions();
        this.input?.close();
        this.input = null;
        running?.close();

        return child?.end() ?? Promise.resolve();
    }

    private queryOptions(executable: string, key: string | null): Options {
        const { selection, runtimeMode, resume, folders, projectConfig, instructions, mcpServers = [] } = this.launch;
        const permissionMode = claudePermissionMode(runtimeMode) as PermissionMode | null;
        const effort = claudeEffort(selection) as EffortLevel | null;
        const settings = claudeSettings(selection);
        const allowedServers = mcpServers.filter((server) => server.allowTools === true).map((server) => `mcp__${server.name}__*`);
        const allowedTools = [...(this.options.allowedTools ?? []), ...allowedServers];

        return {
            // Both always set, so the SDK never looks up the CLI it bundles: chats run on the one the person installed.
            pathToClaudeCodeExecutable: executable,
            spawnClaudeCodeProcess: (spawnOptions) => this.spawnCli(spawnOptions, executable),
            cwd: this.launch.cwd,
            env: this.env(key),
            model: claudeModel(selection),
            ...(effort === null ? {} : { effort }),
            ...(settings === null ? {} : { settings }),
            ...(permissionMode === null ? {} : { permissionMode }),
            ...(permissionMode === 'bypassPermissions' ? { allowDangerouslySkipPermissions: true } : {}),
            ...(resume ? { resume } : {}),
            ...(allowedTools.length > 0 ? { allowedTools } : {}),
            ...(folders && folders.length > 0 ? { additionalDirectories: [...folders] } : {}),
            // Strict MCP also drops the person's own MCP servers and connectors (measured on Claude Code 2.1.300).
            ...(key !== null ? { settingSources: [], strictMcpConfig: true } : {}),
            ...(key === null && projectConfig === false ? { settingSources: ['user' as const], strictMcpConfig: true } : {}),
            ...(mcpServers.length > 0 ? { mcpServers: Object.fromEntries(mcpServers.map((server) => [server.name, mcpConfig(server)])) } : {}),
            // Without a preset the SDK starts the CLI on an empty system prompt instead of its own.
            systemPrompt: { type: 'preset', preset: 'claude_code', ...(instructions === null ? {} : { append: instructions }) },
            includePartialMessages: true,
            canUseTool: (toolName, input, permission) => this.askPermission(toolName, input, permission),
            // The echo of a message is what acknowledges a steer, and the SDK leaves the flag out.
            extraArgs: { 'replay-user-messages': null }
        };
    }

    // The process environment only: an `env` in the person's own Claude settings still wins in the CLI.
    private env(key: string | null): Record<string, string> {
        const entrypoint: Record<string, string> = this.options.entrypoint === undefined ? {} : { CLAUDE_CODE_ENTRYPOINT: this.options.entrypoint };
        const env = { ...this.launch.env, ...claudeEnv(this.launch.selection), ...entrypoint };

        if (key === null || !this.options.apiKey) {
            return env;
        }

        const kept = Object.fromEntries(Object.entries(env).filter(([name]) => !movesTheKey(name)));

        return {
            ...kept,
            ANTHROPIC_API_KEY: key,
            CLAUDE_CONFIG_DIR: this.options.apiKey.configDir,
            ...NO_NONESSENTIAL_TRAFFIC,
            ...entrypoint
        };
    }

    /* Starts the launch command with the SDK's flags behind its own, through the spawn every other backend uses. */
    private spawnCli(options: SpawnOptions, executable: string): SpawnedProcess {
        const events = new EventEmitter();
        let exitCode: number | null = null;
        let signalCode: NodeJS.Signals | null = null;
        let killed = false;

        const child: ChatChild = new ChatChild({
            command: [...this.launch.command, ...cliArgs(options, executable)],
            cwd: options.cwd ?? this.launch.cwd,
            env: definedEnv(options.env),
            ...(this.launch.spawn ? { spawn: this.launch.spawn } : {}),
            onError: (error) => {
                this.broken(error);

                if (events.listenerCount('error') > 0) {
                    events.emit('error', error);
                }
            },
            onExit: (code, stderr, signal) => {
                exitCode = code;
                signalCode = (signal ?? null) as NodeJS.Signals | null;
                this.childExited = true;
                // The SDK may still hold messages read before the exit; they reach the host first, unless a process the
                // CLI started holds its stdout open, which would keep the stream from ever ending.
                void Promise.race([this.pumping, settleAfter(EXIT_DRAIN_MS)]).then(() => this.handleExit(child, code, stderr));
                events.emit('exit', code, signalCode);
            }
        });

        this.child = child;
        this.childExited = false;
        options.signal.addEventListener('abort', () => void child.end(), { once: true });

        const stdin = new Writable({
            decodeStrings: false,
            write: (chunk: string | Buffer, _encoding, callback) => {
                try {
                    child.process.stdin.write(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
                    child.process.stdin.flush();
                    callback();
                } catch (error) {
                    this.broken(error);
                    callback(asError(error));
                }
            },
            final: (callback) => {
                try {
                    child.process.stdin.end();
                } catch {
                    // Already closed by the other side.
                }

                callback();
            }
        });

        return {
            stdin,
            stdout: Readable.fromWeb(child.process.stdout as unknown as NodeReadableStream<Uint8Array>),
            get killed() {
                return killed;
            },
            get exitCode() {
                return exitCode;
            },
            get signalCode() {
                return signalCode;
            },
            kill: () => {
                killed = true;
                void child.end();

                return true;
            },
            on: (event: 'exit' | 'error', listener: (...args: never[]) => void) => {
                events.on(event, listener as (...args: unknown[]) => void);
            },
            once: (event: 'exit' | 'error', listener: (...args: never[]) => void) => {
                events.once(event, listener as (...args: unknown[]) => void);
            },
            off: (event: 'exit' | 'error', listener: (...args: never[]) => void) => {
                events.off(event, listener as (...args: unknown[]) => void);
            }
        };
    }

    private async pump(running: Query): Promise<void> {
        try {
            for await (const message of running) {
                if (this.query !== running) {
                    return;
                }

                this.read(message);
            }
        } catch (error) {
            // An exit ends the stream with an error of its own; the exit event says it better.
            if (this.query === running && !this.childExited) {
                this.failed(error);
                void this.child?.end();
            }
        }
    }

    private read(message: SDKMessage): void {
        try {
            if (message.type === 'user' && typeof message.uuid === 'string' && (message.parent_tool_use_id ?? null) === null) {
                this.settleSteer(message.uuid, true);
            }

            this.dispatch(this.protocol.handle(message));
        } catch (error) {
            this.failed(error);
        }
    }

    private dispatch(events: BackendEvent[]): void {
        for (const event of events) {
            if (event.type === 'turn.done') {
                this.active = false;
                this.awaitSteers();
            }

            if (event.type === 'turn.done' && this.interrupted) {
                this.interrupted = false;
                // A stopped turn ends in an error result (`[ede_diagnostic] ...` from Claude Code 2.1.317), which is the stop, not a failure.
                const { error: _stopped, ...aborted } = event;
                this.host.onEvent({ ...aborted, state: 'aborted' });

                continue;
            }

            this.host.onEvent(event);
        }
    }

    private askPermission(toolName: string, input: Record<string, unknown>, options: PermissionOptions): Promise<PermissionResult> {
        const { requestId, signal } = options;

        return new Promise((resolve) => {
            this.permissions.set(requestId, resolve);

            signal.addEventListener(
                'abort',
                () => {
                    if (!this.permissions.delete(requestId)) {
                        return;
                    }

                    // The CLI took the request back; the SDK sends nothing for it any more.
                    resolve({ behavior: 'deny', message: 'The request was withdrawn' });
                    this.dispatch(this.protocol.handle({ type: 'control_cancel_request', request_id: requestId }));
                },
                { once: true }
            );

            const request = {
                subtype: 'can_use_tool',
                tool_name: toolName,
                input,
                tool_use_id: options.toolUseID,
                ...(options.agentID ? { agent_id: options.agentID } : {}),
                ...(options.suggestions ? { permission_suggestions: options.suggestions } : {}),
                ...(options.description ? { description: options.description } : {})
            };

            try {
                this.dispatch(this.protocol.handle({ type: 'control_request', request_id: requestId, request }));
            } catch (error) {
                this.failed(error);
            }
        });
    }

    private answer(requestId: string, frame: unknown): boolean {
        if (frame === null) {
            return false;
        }

        const settle = this.permissions.get(requestId);
        this.permissions.delete(requestId);

        if (settle === undefined) {
            return false;
        }

        settle(permissionResult(frame));

        return true;
    }

    private userMessage(input: TurnInput, promptId: string): SDKUserMessage {
        // What the CLI must see first (ultrathink), then the preamble, then what was typed.
        const prefix = `${promptPrefix(this.selection)}${input.preamble === null ? '' : `${input.preamble}\n\n`}`;

        return buildUserMessage({ text: input.text, attachments: input.attachments, prefix, skills: input.skills, promptId }) as SDKUserMessage;
    }

    private push(message: SDKUserMessage): void {
        if (!this.input?.open || this.inputBroken) {
            throw new Error('Claude stdin is closed');
        }

        this.input.push(message);
    }

    private requireQuery(): Query {
        if (!this.query || this.inputBroken) {
            throw new Error('Claude stdin is closed');
        }

        return this.query;
    }

    private settleSteer(promptId: string, accepted: boolean): void {
        this.steers.get(promptId)?.resolve(accepted);
        this.steers.delete(promptId);

        if (this.steers.size === 0) {
            this.clearSteerTimer();
        }
    }

    private awaitSteers(): void {
        if (this.steers.size === 0 || this.steerTimer !== null) {
            return;
        }

        this.steerTimer = setTimeout(() => {
            this.steerTimer = null;

            for (const pending of this.steers.values()) {
                pending.reject(new Error('Claude ended its turn without taking your message'));
            }

            this.steers.clear();
        }, STEER_GRACE_MS);

        this.steerTimer.unref?.();
    }

    private clearSteerTimer(): void {
        if (this.steerTimer !== null) {
            clearTimeout(this.steerTimer);
            this.steerTimer = null;
        }
    }

    private rejectSteers(reason: string): void {
        this.active = false;
        this.clearSteerTimer();

        for (const pending of this.steers.values()) {
            pending.reject(new Error(reason));
        }

        this.steers.clear();
    }

    /* A pipe that failed takes no more writes. */
    private broken(error: unknown): void {
        if (this.inputBroken) {
            return;
        }

        this.inputBroken = true;
        this.failed(error);
    }

    private failed(error: unknown): void {
        this.rejectSteers(`Lost the connection to Claude: ${errorText(error)}`);
        this.protocol.forgetPending();

        try {
            this.host.onEvent({ type: 'failed', message: `Lost the connection to Claude: ${errorText(error)}`, processAlive: this.running });
        } catch (reportError) {
            console.error('Reporting a Claude transport failure failed:', errorText(reportError));
        }
    }

    private handleExit(child: ChatChild, exitCode: number | null, stderr: string | null): void {
        if (this.child !== child) {
            return;
        }

        const running = this.query;
        this.child = null;
        this.query = null;
        this.input?.close();
        this.input = null;
        this.denyPermissions();
        this.rejectSteers('Claude stopped before it got your message');
        this.protocol.forgetPending();
        // Ends a stream a process the CLI started may still hold open; the CLI is gone, so this signals nothing.
        running?.close();
        this.host.onEvent({ type: 'exit', exitCode, ...(stderr === null ? {} : { stderr }) });
    }

    /* Answers every request the CLI still waits on, so no `canUseTool` promise is left hanging once the backend lets go. */
    private denyPermissions(): void {
        const waiting = [...this.permissions.values()];
        this.permissions.clear();

        for (const settle of waiting) {
            settle({ behavior: 'deny', message: 'Claude stopped' });
        }
    }
}
