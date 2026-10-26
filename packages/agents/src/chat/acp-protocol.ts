import { isRecord, type AgentKind, type ChatFileChange, type ChatQuestion, type ChatTurnLimit, type RuntimeMode } from '@adecore/agent-contracts';
import { z } from 'zod';
import { filledStr } from '../fields.ts';
import { MODE_ORDER } from '../modes.ts';
import { cleanTitle } from '../title-file.ts';
import type { ApprovalDecision, BackendEvent } from './backend.ts';

/*
 * The Agent Client Protocol (https://agentclientprotocol.com), version 1, as far as a chat needs it.
 * Every schema is loose: an agent may add fields, and a field or an update this version does not
 * know is ignored rather than refused, as the protocol asks of a client.
 */

export const ACP_PROTOCOL_VERSION = 1;

// The code an agent answers `session/new` or `session/load` with when it needs `authenticate` first.
export const ACP_AUTH_REQUIRED = -32000;

const ContentBlockSchema = z.looseObject({ type: z.string(), text: z.string().optional() });

const ContentChunkSchema = z.looseObject({ content: ContentBlockSchema, messageId: z.string().nullish() });

const ToolCallSchema = z.looseObject({
    toolCallId: z.string(),
    title: z.string().nullish(),
    name: z.string().nullish(),
    kind: z.string().nullish(),
    status: z.string().nullish(),
    content: z.array(z.unknown()).nullish(),
    locations: z.array(z.unknown()).nullish(),
    rawInput: z.unknown().optional(),
    rawOutput: z.unknown().optional()
});

const DiffSchema = z.looseObject({ type: z.literal('diff'), path: z.string(), oldText: z.string().nullish(), newText: z.string() });

const ToolContentSchema = z.looseObject({ type: z.literal('content'), content: ContentBlockSchema });

const LocationSchema = z.looseObject({ path: z.string() });

const PlanEntrySchema = z.looseObject({ content: z.string(), status: z.string(), priority: z.string().optional() });

const CommandSchema = z.looseObject({ name: z.string() });

const UsageSchema = z.looseObject({
    used: z.number(),
    size: z.number(),
    cost: z.looseObject({ amount: z.number(), currency: z.string() }).nullish()
});

const PermissionOptionSchema = z.looseObject({ optionId: z.string(), name: z.string(), kind: z.string() });

const PermissionRequestSchema = z.looseObject({
    sessionId: z.string(),
    toolCall: ToolCallSchema,
    options: z.array(PermissionOptionSchema)
});

/*
 * Grok's questions to the person (`_x.ai/ask_user_question` in xai-org/grok-build, `ask_user_question/types.rs`). The
 * answer goes back keyed by the question's text, each a list of the labels picked.
 */
export const GROK_QUESTION_METHODS: readonly string[] = ['_x.ai/ask_user_question', 'x.ai/ask_user_question'];

const GrokQuestionSchema = z.looseObject({
    question: z.string(),
    header: z.string().nullish(),
    options: z.array(z.unknown()).nullish(),
    multiSelect: z.boolean().nullish()
});

const GrokChoiceSchema = z.looseObject({ label: z.string(), description: z.string().nullish() });

const GrokQuestionRequestSchema = z.looseObject({ sessionId: z.string(), questions: z.array(z.unknown()) });

// The label Grok takes for an answer in a person's own words, which ride along as the question's `notes`.
const GROK_OWN_ANSWER = 'Other';

/*
 * The prefix Antigravity's ACP server 1.4.1 gives the tool call of a question it asks over `session/request_permission`,
 * one request per question with an option per choice (`ExternalOnInteractionHook`).
 */
const INTERACTION_PREFIX = 'interaction_';

const SessionNotificationSchema = z.looseObject({ sessionId: z.string(), update: z.looseObject({ sessionUpdate: z.string() }) });

const PromptResponseSchema = z.looseObject({ stopReason: z.string() });

const tokenCount = z.number().int().nonnegative();

// Unstable in the protocol (`PromptResponse.usage`); only the three totals are required.
const PromptUsageSchema = z.looseObject({
    totalTokens: tokenCount,
    inputTokens: tokenCount,
    outputTokens: tokenCount,
    thoughtTokens: tokenCount.nullish(),
    cachedReadTokens: tokenCount.nullish(),
    cachedWriteTokens: tokenCount.nullish()
});

/* The tokens of one turn with their kinds apart, as a usage record keeps them: `reasoning` is a part of `output`. */
export interface AcpTurnUsage {
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
}

/*
 * The `usage` a `session/prompt` response carries, or null where the agent reports none. The protocol
 * leaves open whether the input holds the cached part, so the total decides: when the kinds add up
 * to more than it, the input counted the cache too and loses it here.
 */
export function promptUsageOf(result: unknown): AcpTurnUsage | null {
    const response = z.looseObject({ usage: PromptUsageSchema }).safeParse(result);
    if (!response.success) {
        return null;
    }
    const usage = response.data.usage;
    const cacheRead = usage.cachedReadTokens ?? 0;
    const cacheWrite = usage.cachedWriteTokens ?? 0;
    const apart = usage.inputTokens + usage.outputTokens + cacheRead + cacheWrite <= usage.totalTokens;
    const input = apart ? usage.inputTokens : Math.max(0, usage.inputTokens - cacheRead - cacheWrite);
    if (input + cacheRead + cacheWrite + usage.outputTokens === 0) {
        return null;
    }
    return { input, cacheRead, cacheWrite, output: usage.outputTokens, reasoning: usage.thoughtTokens ?? 0 };
}

const ModeStateSchema = z.looseObject({
    currentModeId: z.string(),
    availableModes: z.array(z.unknown())
});

const ModeSchema = z.looseObject({ id: z.string(), name: z.string() });

const SelectValueSchema = z.looseObject({ value: z.string(), name: z.string(), description: z.string().nullish(), _meta: z.unknown().optional() });

const ConfigOptionSchema = z.looseObject({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    category: z.string().nullish(),
    currentValue: z.unknown().optional(),
    options: z.array(z.unknown()).optional()
});

// Models as agents reported them before the protocol moved them into config options; still sent by some.
const ModelStateSchema = z.looseObject({
    currentModelId: z.string(),
    availableModels: z.array(z.unknown())
});

const ModelEntrySchema = z.looseObject({ modelId: z.string(), name: z.string(), description: z.string().nullish(), _meta: z.unknown().optional() });

/* The context window an agent names for a model in the model's `_meta` (`totalContextTokens`, not part of the protocol); null where it names none. */
function contextWindowOf(meta: unknown): number | null {
    const tokens = isRecord(meta) ? meta.totalContextTokens : undefined;
    return typeof tokens === 'number' && Number.isSafeInteger(tokens) && tokens > 0 ? tokens : null;
}

/*
 * The context tokens an agent counts outside the protocol, in `_meta.totalTokens`: Grok CLI 1.0.62 sends no `usage_update`
 * and puts the session's count there, on every `session/update` notification and on the `session/prompt` response.
 */
function vendorContextTokens(meta: unknown): number | null {
    const tokens = isRecord(meta) ? meta.totalTokens : undefined;
    return typeof tokens === 'number' && Number.isSafeInteger(tokens) && tokens > 0 ? tokens : null;
}

const AuthMethodSchema = z.looseObject({ id: z.string(), name: z.string() });

const InitializeResponseSchema = z.looseObject({
    protocolVersion: z.number(),
    agentCapabilities: z
        .looseObject({
            loadSession: z.boolean().optional(),
            promptCapabilities: z.looseObject({ image: z.boolean().optional(), embeddedContext: z.boolean().optional() }).optional(),
            sessionCapabilities: z
                .looseObject({
                    resume: z.unknown().optional(),
                    additionalDirectories: z.unknown().optional(),
                    close: z.unknown().optional()
                })
                .optional()
        })
        .optional(),
    authMethods: z.array(z.unknown()).optional(),
    agentInfo: z.looseObject({ name: z.string(), title: z.string().nullish(), version: z.string() }).nullish()
});

const SessionResponseSchema = z.looseObject({ sessionId: z.string().optional() });

/* Parses each item on its own, dropping the ones that do not fit instead of the whole list. */
function validItems<T>(schema: z.ZodType<T>, items: readonly unknown[] | null | undefined): T[] {
    return (items ?? []).flatMap((item) => {
        const parsed = schema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
    });
}

export interface AcpAgentInfo {
    name: string;
    title: string | null;
    version: string;
}

/* What `initialize` answered, as far as a chat acts on it. */
export interface AcpAgentCapabilities {
    protocolVersion: number;
    loadSession: boolean;
    resumeSession: boolean;
    additionalDirectories: boolean;
    // Whether the agent takes `session/close`, which ends a session it would otherwise keep.
    closeSession: boolean;
    images: boolean;
    // Whether a prompt may carry a file's text as a `resource` block.
    embeddedContext: boolean;
    authMethods: string[];
    agent: AcpAgentInfo | null;
}

export function parseInitialize(result: unknown): AcpAgentCapabilities {
    const parsed = InitializeResponseSchema.safeParse(result);
    if (!parsed.success) {
        throw new Error('initialize failed: the agent answered with something that is not an initialize response');
    }
    const capabilities = parsed.data.agentCapabilities;
    const sessions = capabilities?.sessionCapabilities;
    const agent = parsed.data.agentInfo;
    return {
        protocolVersion: parsed.data.protocolVersion,
        loadSession: capabilities?.loadSession === true,
        resumeSession: sessions?.resume !== undefined && sessions.resume !== null,
        additionalDirectories: sessions?.additionalDirectories !== undefined && sessions.additionalDirectories !== null,
        closeSession: sessions?.close !== undefined && sessions.close !== null,
        images: capabilities?.promptCapabilities?.image === true,
        embeddedContext: capabilities?.promptCapabilities?.embeddedContext === true,
        authMethods: validItems(AuthMethodSchema, parsed.data.authMethods).map((method) => method.id),
        agent: agent ? { name: agent.name, title: agent.title ?? null, version: agent.version } : null
    };
}

export interface AcpModel {
    id: string;
    name: string;
    description: string | null;
    // In tokens, where the agent names it.
    contextWindow: number | null;
}

/* The models a session offers. `configId` is the config option that picks one, or null where the agent takes `session/set_model`. */
export interface AcpModelState {
    current: string;
    models: AcpModel[];
    configId: string | null;
}

export interface AcpMode {
    id: string;
    name: string;
}

/* The modes a session offers. `configId` is the config option that picks one, or null where the agent takes `session/set_mode`. */
export interface AcpModeState {
    current: string;
    modes: AcpMode[];
    configId: string | null;
}

export interface AcpChoice {
    id: string;
    name: string;
    description: string | null;
}

/* The reasoning effort a session offers: the config option that sets it, the value it runs at and the values it takes. */
export interface AcpThoughtLevel {
    configId: string;
    current: string;
    choices: AcpChoice[];
}

/* What `session/new`, `session/load` or `session/resume` said about the session, for a host that fills its catalog from it. */
export interface AcpSessionInfo {
    sessionId: string;
    agent: AcpAgentInfo | null;
    models: AcpModelState | null;
    modes: AcpModeState | null;
    // A config option of the `thought_level` category, or one with the id `reasoning_effort` where an agent sets no category.
    thoughtLevel: AcpThoughtLevel | null;
}

type ConfigOption = z.infer<typeof ConfigOptionSchema>;

/* The values of a select option, grouped or not. */
function selectValues(option: ConfigOption): Array<z.infer<typeof SelectValueSchema>> {
    const flat = (option.options ?? []).flatMap((entry) => (isRecord(entry) && Array.isArray(entry.options) ? entry.options : [entry]));
    return validItems(SelectValueSchema, flat);
}

function selectOption(options: ConfigOption[], category: string): ConfigOption | null {
    return options.find((option) => option.type === 'select' && option.category === category && typeof option.currentValue === 'string') ?? null;
}

function thoughtOption(options: ConfigOption[]): ConfigOption | null {
    return (
        selectOption(options, 'thought_level') ??
        options.find((option) => option.type === 'select' && option.id === 'reasoning_effort' && typeof option.currentValue === 'string') ??
        null
    );
}

/* The reasoning effort in a response that carries the session's config options; undefined when it carries none. */
export function thoughtLevelOf(result: unknown): AcpThoughtLevel | null | undefined {
    if (!isRecord(result) || !Array.isArray(result.configOptions)) {
        return undefined;
    }
    return sessionState(validItems(ConfigOptionSchema, result.configOptions), null, null).thoughtLevel;
}

export function parseSessionInfo(result: unknown, sessionId: string, agent: AcpAgentInfo | null): AcpSessionInfo {
    const record = isRecord(result) ? result : {};
    const options = validItems(ConfigOptionSchema, Array.isArray(record.configOptions) ? record.configOptions : []);
    return { sessionId, agent, ...sessionState(options, record.modes, record.models) };
}

function sessionState(options: ConfigOption[], modes: unknown, models: unknown): Omit<AcpSessionInfo, 'sessionId' | 'agent'> {
    const modelOption = selectOption(options, 'model');
    const modeOption = selectOption(options, 'mode');
    const thought = thoughtOption(options);
    const modeState = ModeStateSchema.safeParse(modes);
    const modelState = ModelStateSchema.safeParse(models);
    const entries = modelState.success ? validItems(ModelEntrySchema, modelState.data.availableModels) : [];
    // Grok CLI 1.0.62 offers its models as a config option too, but names their windows only in the older field.
    const windows = new Map(entries.map((model) => [model.modelId, contextWindowOf(model._meta)]));
    return {
        models: modelOption
            ? {
                  current: modelOption.currentValue as string,
                  models: selectValues(modelOption).map((value) => ({
                      id: value.value,
                      name: value.name,
                      description: null,
                      contextWindow: contextWindowOf(value._meta) ?? windows.get(value.value) ?? null
                  })),
                  configId: modelOption.id
              }
            : modelState.success
              ? {
                    current: modelState.data.currentModelId,
                    models: entries.map((model) => ({
                        id: model.modelId,
                        name: model.name,
                        description: model.description ?? null,
                        contextWindow: contextWindowOf(model._meta)
                    })),
                    configId: null
                }
              : null,
        modes: modeOption
            ? {
                  current: modeOption.currentValue as string,
                  modes: selectValues(modeOption).map((value) => ({ id: value.value, name: value.name })),
                  configId: modeOption.id
              }
            : modeState.success
              ? {
                    current: modeState.data.currentModeId,
                    modes: validItems(ModeSchema, modeState.data.availableModes).map((mode) => ({ id: mode.id, name: mode.name })),
                    configId: null
                }
              : null,
        thoughtLevel: thought
            ? {
                  configId: thought.id,
                  current: thought.currentValue as string,
                  choices: selectValues(thought).map((value) => ({ id: value.value, name: value.name, description: value.description ?? null }))
              }
            : null
    };
}

function commandNames(commands: unknown): string[] {
    return validItems(CommandSchema, Array.isArray(commands) ? commands : []).map((command) => command.name);
}

/* The session a `session/update` notification is for, and the commands it lists when it is an `available_commands_update`; null when it does not parse. */
export function sessionUpdateOf(params: unknown): { sessionId: string; commands: string[] | null } | null {
    const notification = SessionNotificationSchema.safeParse(params);
    if (!notification.success) {
        return null;
    }
    const update = notification.data.update;
    return {
        sessionId: notification.data.sessionId,
        commands: update.sessionUpdate === 'available_commands_update' ? commandNames(update.availableCommands) : null
    };
}

export function sessionIdOf(result: unknown): string | null {
    const parsed = SessionResponseSchema.safeParse(result);
    return parsed.success ? (parsed.data.sessionId ?? null) : null;
}

/* The agent's own mode ids per runtime mode, best first. */
export type AcpModeMap = Partial<Record<RuntimeMode, readonly string[]>>;

/*
 * The agent mode a runtime mode runs in: the first id the agent offers for that mode, else for the
 * next narrower one, and so on down to `supervised`. Never a wider one; null when nothing fits.
 */
export function resolveAcpMode(requested: RuntimeMode, map: AcpModeMap, offered: readonly string[]): { modeId: string; runtimeMode: RuntimeMode } | null {
    for (let index = MODE_ORDER.indexOf(requested); index >= 0; index--) {
        const runtimeMode = MODE_ORDER[index]!;
        const modeId = (map[runtimeMode] ?? []).find((candidate) => offered.includes(candidate));
        if (modeId !== undefined) {
            return { modeId, runtimeMode };
        }
    }
    return null;
}

/* The widest runtime mode a map puts an agent mode under, which is what that mode grants; null for one it does not name. */
export function runtimeModeOf(modeId: string, map: AcpModeMap): RuntimeMode | null {
    for (let index = MODE_ORDER.length - 1; index >= 0; index--) {
        const runtimeMode = MODE_ORDER[index]!;
        if ((map[runtimeMode] ?? []).includes(modeId)) {
            return runtimeMode;
        }
    }
    return null;
}

// The tool kinds whose requests a runtime mode answers on its own when the agent has no mode for it.
const AUTO_ALLOWED: Record<RuntimeMode, ReadonlySet<string> | 'all'> = {
    supervised: new Set(),
    'auto-accept-edits': new Set(['read', 'search', 'think', 'edit', 'move']),
    auto: new Set(['read', 'search', 'think', 'edit', 'move', 'fetch']),
    'full-access': 'all'
};

export function autoAllows(mode: RuntimeMode, kind: string | null): boolean {
    const allowed = AUTO_ALLOWED[mode];
    return allowed === 'all' || (kind !== null && allowed.has(kind));
}

/* The trimmed hunk between two texts, as one unified diff; null when they are the same. */
export function unifiedDiff(oldText: string, newText: string): string | null {
    const lines = (text: string): string[] => {
        const split = text === '' ? [] : text.split('\n');
        if (split.at(-1) === '') {
            split.pop();
        }
        return split;
    };
    const before = lines(oldText);
    const after = lines(newText);
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
        prefix++;
    }
    let suffix = 0;
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
        suffix++;
    }
    const removed = before.slice(prefix, before.length - suffix);
    const added = after.slice(prefix, after.length - suffix);
    if (removed.length === 0 && added.length === 0) {
        return null;
    }
    const range = (count: number): string => `${count === 0 ? prefix : prefix + 1},${count}`;
    return (
        [`@@ -${range(removed.length)} +${range(added.length)} @@`, ...removed.map((line) => `-${line}`), ...added.map((line) => `+${line}`)].join('\n') + '\n'
    );
}

type Diff = z.infer<typeof DiffSchema>;

interface ToolState {
    title: string;
    name: string | null;
    kind: string | null;
    status: string | null;
    rawInput: unknown;
    rawOutput: unknown;
    locations: string[];
    diffs: Diff[];
    text: string[];
    // What the thread last heard, so an update that changes nothing about the row sends nothing.
    shown: string | null;
    settled: boolean;
    // A person turned the call down, so whatever diff it carries was never written.
    refused: boolean;
}

// `Edit` would have the thread draw a diff of nothing until the agent sends one.
const KIND_NAMES: Record<string, string> = {
    edit: 'Change',
    delete: 'Delete',
    move: 'Move',
    think: 'Think',
    switch_mode: 'Switch mode',
    other: 'Tool'
};

// A session's title comes from its opening prompts; later ones are not kept.
const KEPT_PROMPTS = 3;

// What Copilot CLI 1.0.101 writes as a message of its own after a call a person turned down; the thread shows the refusal already.
const REFUSAL_LINE = 'Info: Operation cancelled by user';

/*
 * What Antigravity's ACP server 1.4.1 writes in place of an answer once the account's quota ran out (`quota_errors.py`).
 * Its turn still ends with `end_turn`, so this text is all that tells the limit apart.
 */
const QUOTA_HEAD = 'Usage Limit Reached\n\nYou have reached your current quota for this period.';

/* Whether a message may still turn out to be one the thread does not show: the refusal line after a refusal, or a limit message. */
function withheld(text: string, afterRefusal: boolean): boolean {
    return (afterRefusal && REFUSAL_LINE.startsWith(text)) || QUOTA_HEAD.startsWith(text) || text.startsWith(QUOTA_HEAD);
}

function foldSpace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

// Where agents put the command a call runs; Antigravity names it `CommandLine`.
const COMMAND_KEYS = ['command', 'cmd', 'CommandLine'];

/* A field of the agent's own input, which no schema promises; the first one that is a non-empty string. */
function rawField(raw: unknown, ...keys: string[]): string | null {
    if (!isRecord(raw)) {
        return null;
    }
    for (const key of keys) {
        const value = raw[key];
        if (Array.isArray(value) && value.every((part) => typeof part === 'string') && value.length > 0) {
            return value.join(' ');
        }
        if (filledStr(value) !== null) {
            return value as string;
        }
    }
    return null;
}

/* The row a tool call becomes: a name the thread has words for where the kind says which, and an input it reads a subject from. */
export function toolRow(tool: Pick<ToolState, 'title' | 'name' | 'kind' | 'rawInput' | 'locations' | 'diffs'>): {
    name: string;
    input: Record<string, unknown>;
    changes?: ChatFileChange[];
} {
    const description = tool.title;
    const path = tool.locations[0] ?? rawField(tool.rawInput, 'file_path', 'path', 'filePath') ?? null;
    if (tool.diffs.length > 0) {
        const paths = new Set(tool.diffs.map((diff) => diff.path));
        if (paths.size === 1) {
            const [first] = tool.diffs;
            if (tool.diffs.length === 1 && (first!.oldText ?? null) === null) {
                return { name: 'Write', input: { file_path: first!.path, content: first!.newText, description } };
            }
            if (tool.diffs.length === 1) {
                return { name: 'Edit', input: { file_path: first!.path, old_string: first!.oldText, new_string: first!.newText, description } };
            }
            return {
                name: 'MultiEdit',
                input: { file_path: first!.path, edits: tool.diffs.map((diff) => ({ old_string: diff.oldText ?? '', new_string: diff.newText })), description }
            };
        }
        const changes = tool.diffs.flatMap((diff): ChatFileChange[] => {
            const text = unifiedDiff(diff.oldText ?? '', diff.newText);
            return text === null ? [] : [{ path: diff.path, kind: (diff.oldText ?? null) === null ? 'add' : 'update', diff: text }];
        });
        return { name: 'ApplyPatch', input: { summary: [...paths].join(', '), description }, changes };
    }
    const raw = isRecord(tool.rawInput) ? tool.rawInput : {};
    switch (tool.kind) {
        case 'execute':
            return { name: 'Bash', input: { ...raw, description, command: rawField(tool.rawInput, ...COMMAND_KEYS) ?? description } };
        case 'read':
            return { name: 'Read', input: { ...raw, description, ...(path === null ? {} : { file_path: path }) } };
        case 'search':
            return { name: 'Grep', input: { ...raw, description, pattern: rawField(tool.rawInput, 'pattern', 'query', 'regex') ?? description } };
        case 'fetch': {
            const url = rawField(tool.rawInput, 'url', 'uri');
            return url === null
                ? { name: 'WebSearch', input: { ...raw, description, query: rawField(tool.rawInput, 'query') ?? description } }
                : { name: 'WebFetch', input: { ...raw, description, url } };
        }
        default:
            return {
                name: tool.name ?? KIND_NAMES[tool.kind ?? 'other'] ?? 'Tool',
                input: { description, ...raw, ...(path === null ? {} : { path }) }
            };
    }
}

function toolOutput(tool: ToolState): string | null {
    if (tool.text.length > 0) {
        return tool.text.join('\n');
    }
    if (typeof tool.rawOutput === 'string') {
        return tool.rawOutput;
    }
    if (isRecord(tool.rawOutput)) {
        const text = rawField(tool.rawOutput, 'output', 'stdout', 'content', 'result', 'error', 'message');
        return text ?? JSON.stringify(tool.rawOutput);
    }
    return null;
}

/* What an agent asks permission for, in the plain form a host's `autoAllow` judges it by. */
export interface AcpPermissionRequest {
    // The ACP tool kind (`execute`, `edit`, `fetch`, ...), or null when the agent names none.
    kind: string | null;
    title: string | null;
    // Every text the call carries that may be what it runs: the command in its raw input and each text in its
    // content. The agent decides which one it runs, so a host allows the call only when every one passes.
    commands: string[];
}

/* A permission request as the backend acts on it: the event it raises, and the tool kind a runtime mode may answer it by. */
export interface AcpPermission {
    requestId: string;
    rpcId: number | string;
    kind: string | null;
    request: AcpPermissionRequest;
    events: BackendEvent[];
}

/* A question an agent asks the person, as the backend acts on it. */
export interface AcpQuestion {
    requestId: string;
    rpcId: number | string;
    events: BackendEvent[];
}

/* The words a turn that ended for another reason than its end leaves in the thread, and a question it could not answer. */
export interface AcpStopWords {
    maxTokens: string;
    maxTurnRequests: string;
    refusal: string;
    ownAnswer: string;
}

export function acpStopWords(agentName: string): AcpStopWords {
    return {
        maxTokens: `${agentName} stopped because the reply hit its length limit.`,
        maxTurnRequests: `${agentName} stopped because this turn hit its step limit.`,
        refusal: `${agentName} refused to continue this turn.`,
        ownAnswer: `${agentName} accepts only the answers it offered, so it did not get yours.`
    };
}

// Grok's code for a request its API turned down with a 429, after its own retry (`RATE_LIMITED_ERROR_CODE` in xai-org/grok-build).
const GROK_RATE_LIMITED = -32003;

// What that 429 says when an account on the free tier spent its usage; any other 429 is a rate limit.
const GROK_FREE_USAGE = 'subscription:free-usage-exhausted';

// The stream error types of an overloaded model, as Grok passes them on in its error text.
const OVERLOADED_TYPES = /\b(overloaded_error|service_unavailable_error)\b/;

/*
 * The limit a failed `session/prompt` names in its JSON-RPC error; null for any other failure. ACP 1 has no code
 * for a limit, so this reads Grok 1.0.62's: -32003 after a 429, which only Grok means that way, and -32603 with the
 * HTTP status or the stream error of an overloaded model once its own retries ran out. Neither says when a limit lifts.
 */
export function acpErrorLimit(code: number | null, data: unknown, kind: AgentKind | null): ChatTurnLimit | null {
    const text = typeof data === 'string' ? data : isRecord(data) && typeof data.message === 'string' ? data.message : '';
    if (code === GROK_RATE_LIMITED && kind === 'grok') {
        return text.includes(GROK_FREE_USAGE) ? { kind: 'usage' } : { kind: 'overload' };
    }
    if (code !== -32603) {
        return null;
    }
    const status = isRecord(data) && typeof data.http_status === 'number' ? data.http_status : null;
    const overloaded = status === 529 || OVERLOADED_TYPES.test(text) || (status !== null && status >= 500 && /overloaded/i.test(text));
    return overloaded ? { kind: 'overload' } : null;
}

function quotaLimit(quota: { resetsAt: number | null }): ChatTurnLimit {
    return { kind: 'usage', ...(quota.resetsAt === null ? {} : { resetsAt: quota.resetsAt }) };
}

const UNIT_MS: Record<string, number> = { second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/*
 * When the quota in an Antigravity limit message lifts, rounded up: the server writes the two largest units of the
 * delay and drops the rest (`will reset in 4 days, 23 hours.`), or the time to the minute (`will reset on Oct 21,
 * 2026 14:05 UTC.`). Null when it names neither.
 */
export function quotaResetOf(text: string, now: number): number | null {
    const relative = /will reset in ([^.]+)\./.exec(text);
    if (relative) {
        let total = 0;
        let smallest = Infinity;
        for (const part of relative[1]!.split(',')) {
            const amount = /^(\d+) (second|minute|hour|day)s?$/.exec(part.trim());
            if (!amount) {
                return null;
            }
            const unit = UNIT_MS[amount[2]!]!;
            total += Number(amount[1]) * unit;
            smallest = Math.min(smallest, unit);
        }
        return now + total + smallest;
    }
    const absolute = /will reset on ([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) (\d{2}):(\d{2}) UTC\./.exec(text);
    const month = absolute ? MONTHS.indexOf(absolute[1]!) : -1;
    if (!absolute || month === -1) {
        return null;
    }
    return Date.UTC(Number(absolute[3]), month, Number(absolute[2]), Number(absolute[4]), Number(absolute[5])) + UNIT_MS.minute!;
}

/* The labels a person picked, out of the one answer a question card gives (choices joined with `, `); null for words of their own. */
function pickedLabels(answer: string, labels: readonly string[], multiSelect: boolean): string[] | null {
    if (labels.includes(answer)) {
        return [answer];
    }
    if (!multiSelect) {
        return null;
    }
    // A label may hold `, ` itself, so the pieces join up again until they make one.
    const picked: string[] = [];
    let part = '';
    for (const piece of answer.split(', ')) {
        part = part === '' ? piece : `${part}, ${piece}`;
        if (labels.includes(part)) {
            picked.push(part);
            part = '';
        }
    }
    return part === '' && picked.length > 0 ? picked : null;
}

type PendingQuestion =
    | { shape: 'grok'; rpcId: number | string; questions: ChatQuestion[] }
    | { shape: 'interaction'; rpcId: number | string; question: ChatQuestion; options: Array<z.infer<typeof PermissionOptionSchema>> };

function cancelledAnswer(pending: PendingQuestion): unknown {
    return pending.shape === 'grok' ? { outcome: 'cancelled' } : { outcome: { outcome: 'cancelled' } };
}

/*
 * One ACP session's `session/update` stream, mapped onto backend events. A message's chunks become
 * one text item, cut where the agent switches to a thought or a tool; a tool call becomes a row that
 * is drawn again whenever an update changes what it shows, and settles when it completes or fails.
 */
export class AcpProtocol {
    private readonly generation: number;
    private readonly modes: AcpModeMap;
    private readonly words: AcpStopWords;
    private readonly tools = new Map<string, ToolState>();
    private readonly permissions = new Map<string, { rpcId: number | string; toolCallId: string; options: Array<z.infer<typeof PermissionOptionSchema>> }>();
    private readonly questions = new Map<string, PendingQuestion>();
    // `held` while the message may still be the refusal line or a limit message, whose chunks the thread has not heard yet.
    private text: { ref: string; messageId: string | null; text: string; held: boolean; afterRefusal: boolean } | null = null;
    // Set by a refusal until the next message shows whether it is the refusal line.
    private refusalLine = false;
    // The limit message of this turn, held back from the thread: it ends the turn as a limit, or shows as text when the turn ends otherwise.
    private quota: { ref: string; text: string; resetsAt: number | null } | null = null;
    private readonly now: () => number;
    private thought: { ref: string; text: string } | null = null;
    private counter = 0;
    private costUsd = 0;
    // Set by the first `usage_update`; from then on a count outside the protocol is never read.
    private standardUsage = false;
    private vendorTokens: number | null = null;
    // The opening prompts of the process, whitespace folded, which an agent may hand back as the session's title.
    private readonly prompts: string[] = [];

    private readonly titles: boolean;

    // `titles` takes the session titles the agent sends as the chat's suggested title.
    constructor(generation: number, modes: AcpModeMap, words: AcpStopWords, titles = false, now: () => number = Date.now) {
        this.generation = generation;
        this.modes = modes;
        this.words = words;
        this.titles = titles;
        this.now = now;
    }

    /* One `session/update` notification; empty for another session, an unknown update or one that does not parse. */
    update(sessionId: string, params: unknown): BackendEvent[] {
        const notification = SessionNotificationSchema.safeParse(params);
        if (!notification.success || notification.data.sessionId !== sessionId) {
            return [];
        }
        return [...this.mapUpdate(notification.data.update), ...this.vendorUsage(notification.data._meta)];
    }

    private mapUpdate(update: z.infer<typeof SessionNotificationSchema>['update']): BackendEvent[] {
        switch (update.sessionUpdate) {
            case 'agent_message_chunk':
                return this.messageChunk(update);
            case 'agent_thought_chunk':
                return this.thoughtChunk(update);
            case 'tool_call':
            case 'tool_call_update': {
                const call = ToolCallSchema.safeParse(update);
                return call.success ? [...this.closeText(), ...this.closeThought(), ...this.toolCall(call.data)] : [];
            }
            case 'plan':
                return this.plan(update);
            case 'available_commands_update':
                return [{ type: 'session', agentSessionId: null, model: null, slashCommands: commandNames(update.availableCommands) }];
            case 'current_mode_update':
                return typeof update.currentModeId === 'string' ? [this.modeEvent(update.currentModeId)] : [];
            case 'config_option_update': {
                const options = validItems(ConfigOptionSchema, Array.isArray(update.configOptions) ? update.configOptions : []);
                const state = sessionState(options, null, null);
                return [
                    ...(state.models === null ? [] : [{ type: 'model', model: state.models.current } as const]),
                    ...(state.modes === null ? [] : [this.modeEvent(state.modes.current)])
                ];
            }
            case 'usage_update': {
                const usage = UsageSchema.safeParse(update);
                if (!usage.success) {
                    return [];
                }
                this.standardUsage = true;
                const cost = usage.data.cost?.currency === 'USD' ? usage.data.cost.amount : undefined;
                if (cost !== undefined) {
                    this.costUsd = cost;
                }
                return [{ type: 'usage', contextTokens: usage.data.used, contextWindow: usage.data.size, ...(cost === undefined ? {} : { costUsd: cost }) }];
            }
            case 'session_info_update': {
                if (!this.titles) {
                    return [];
                }
                const title = cleanTitle(update.title);
                return title === null || this.restatesPrompt(title) ? [] : [{ type: 'title', title }];
            }
            default:
                return [];
        }
    }

    /* The fallback for an agent that sends no `usage_update`: its own count of the context, once each time it changes. */
    private vendorUsage(meta: unknown): BackendEvent[] {
        const tokens = this.standardUsage ? null : vendorContextTokens(meta);
        if (tokens === null || tokens === this.vendorTokens) {
            return [];
        }
        this.vendorTokens = tokens;
        return [{ type: 'usage', contextTokens: tokens }];
    }

    /* Notes a prompt sent to the agent, so a title that only repeats its start is not taken for a name. */
    prompted(text: string): void {
        if (this.prompts.length < KEPT_PROMPTS) {
            this.prompts.push(foldSpace(text));
        }
    }

    /*
     * Whether a title is only the start of a prompt, as Copilot CLI 1.0.101 names a session: with a host's instructions in
     * front of the message that names every chat after them, and it keeps the host from naming the chat itself.
     */
    private restatesPrompt(title: string): boolean {
        const start = foldSpace(title.endsWith('…') ? title.slice(0, -1) : title);
        return start !== '' && this.prompts.some((prompt) => prompt.startsWith(start));
    }

    modeEvent(modeId: string): BackendEvent {
        const runtimeMode = runtimeModeOf(modeId, this.modes);
        return { type: 'permissions', permissionMode: modeId, ...(runtimeMode === null ? {} : { effectiveRuntimeMode: runtimeMode }) };
    }

    /* A `session/request_permission` request; null when it does not parse, which the caller answers with an error. */
    permission(rpcId: number | string, sessionId: string, params: unknown): AcpPermission | null {
        const request = PermissionRequestSchema.safeParse(params);
        if (!request.success || request.data.sessionId !== sessionId) {
            return null;
        }
        const requestId = `acp-${this.generation}-${String(rpcId)}`;
        const events = [...this.closeText(), ...this.closeThought(), ...this.toolCall(request.data.toolCall, false)];
        const tool = this.tools.get(request.data.toolCall.toolCallId)!;
        const row = toolRow(tool);
        const options = request.data.options;
        this.permissions.set(requestId, { rpcId, toolCallId: request.data.toolCall.toolCallId, options });
        events.push({
            type: 'approval.requested',
            requestId,
            ref: request.data.toolCall.toolCallId,
            toolName: row.name,
            input: row.changes ? { ...row.input, changes: row.changes } : row.input,
            description: tool.title === '' ? null : tool.title,
            canAllowAlways: options.some((option) => option.kind === 'allow_always')
        });
        const command = rawField(tool.rawInput, ...COMMAND_KEYS);
        const asked = { kind: tool.kind, title: tool.title === '' ? null : tool.title, commands: [...(command === null ? [] : [command]), ...tool.text] };
        return { requestId, rpcId, kind: tool.kind, request: asked, events };
    }

    /*
     * The answer to a permission request: allow once, reject, or allow always only when the agent offered it.
     * A decision the agent offered no option for falls to the narrower one, and a refusal with no reject option
     * at all is a cancelled outcome. A refusal draws the call's row again without its diff.
     */
    answer(requestId: string, decision: ApprovalDecision): { rpcId: number | string; result: unknown; events: BackendEvent[] } | null {
        const pending = this.permissions.get(requestId);
        if (!pending) {
            return null;
        }
        this.permissions.delete(requestId);
        const byKind = (...kinds: string[]): string | null => {
            for (const kind of kinds) {
                const option = pending.options.find((candidate) => candidate.kind === kind);
                if (option) {
                    return option.optionId;
                }
            }
            return null;
        };
        const optionId =
            decision === 'allow-always'
                ? byKind('allow_always', 'allow_once')
                : decision === 'allow'
                  ? byKind('allow_once', 'allow_always')
                  : byKind('reject_once', 'reject_always');
        const result = { outcome: optionId === null ? { outcome: 'cancelled' } : { outcome: 'selected', optionId } };
        const tool = this.tools.get(pending.toolCallId);
        if (decision !== 'deny' || tool === undefined) {
            return { rpcId: pending.rpcId, result, events: [] };
        }
        tool.refused = true;
        this.refusalLine = true;
        return { rpcId: pending.rpcId, result, events: this.toolCall({ toolCallId: pending.toolCallId }, false) };
    }

    /* A Grok `ask_user_question` request; null when it does not parse or asks nothing, which the caller answers with an error. */
    question(rpcId: number | string, sessionId: string, params: unknown): AcpQuestion | null {
        const request = GrokQuestionRequestSchema.safeParse(params);
        if (!request.success || request.data.sessionId !== sessionId) {
            return null;
        }
        const questions = validItems(GrokQuestionSchema, request.data.questions).map((question, index): ChatQuestion => ({
            id: String(index),
            header: question.header ?? '',
            question: question.question,
            choices: validItems(GrokChoiceSchema, question.options).map((choice) => ({ label: choice.label, description: choice.description ?? '' })),
            multiSelect: question.multiSelect === true
        }));
        if (questions.length === 0) {
            return null;
        }
        return this.ask(rpcId, { shape: 'grok', rpcId, questions });
    }

    /*
     * A `session/request_permission` that is a question rather than a permission, as Antigravity asks one: one choice of
     * several, never a call to run. Null for every other permission request.
     */
    interaction(rpcId: number | string, sessionId: string, params: unknown): AcpQuestion | null {
        const request = PermissionRequestSchema.safeParse(params);
        if (!request.success || request.data.sessionId !== sessionId) {
            return null;
        }
        const call = request.data.toolCall;
        const raw = call.rawInput;
        const bare = raw === undefined || raw === null || (isRecord(raw) && Object.keys(raw).length === 0);
        if (!call.toolCallId.startsWith(INTERACTION_PREFIX) || !bare || call.kind || request.data.options.length === 0) {
            return null;
        }
        const question: ChatQuestion = {
            id: '0',
            header: '',
            question: call.title ?? '',
            choices: request.data.options.map((option) => ({ label: option.name, description: '' })),
            multiSelect: false
        };
        return this.ask(rpcId, { shape: 'interaction', rpcId, question, options: request.data.options });
    }

    private ask(rpcId: number | string, pending: PendingQuestion): AcpQuestion {
        const requestId = `acp-${this.generation}-${String(rpcId)}`;
        this.questions.set(requestId, pending);
        const questions = pending.shape === 'grok' ? pending.questions : [pending.question];
        return { requestId, rpcId, events: [...this.closeText(), ...this.closeThought(), { type: 'question.requested', requestId, questions }] };
    }

    /* The answer to a question in the agent's own shape, from the card's answers keyed by question id. */
    answerQuestion(requestId: string, answers: Record<string, string>): { rpcId: number | string; result: unknown; events: BackendEvent[] } | null {
        const pending = this.questions.get(requestId);
        if (!pending) {
            return null;
        }
        this.questions.delete(requestId);
        if (pending.shape === 'interaction') {
            const given = (answers[pending.question.id] ?? '').trim();
            const option = pending.options.find((candidate) => candidate.name === given) ?? pending.options.find((candidate) => candidate.optionId === given);
            if (option === undefined) {
                return {
                    rpcId: pending.rpcId,
                    result: { outcome: { outcome: 'cancelled' } },
                    events: [{ type: 'note', level: 'warning', text: this.words.ownAnswer }]
                };
            }
            return { rpcId: pending.rpcId, result: { outcome: { outcome: 'selected', optionId: option.optionId } }, events: [] };
        }
        const picked: Record<string, string[]> = {};
        const notes: Record<string, { notes: string }> = {};
        for (const question of pending.questions) {
            const given = answers[question.id];
            if (given === undefined) {
                continue;
            }
            const labels = pickedLabels(
                given,
                question.choices.map((choice) => choice.label),
                question.multiSelect
            );
            picked[question.question] = labels ?? [GROK_OWN_ANSWER];
            if (labels === null) {
                notes[question.question] = { notes: given };
            }
        }
        return {
            rpcId: pending.rpcId,
            result: { outcome: 'accepted', answers: picked, ...(Object.keys(notes).length === 0 ? {} : { annotations: notes }) },
            events: []
        };
    }

    /* Turns one question down, in the shape its agent takes a refusal in. */
    cancelQuestion(requestId: string): { rpcId: number | string; result: unknown } | null {
        const pending = this.questions.get(requestId);
        if (!pending) {
            return null;
        }
        this.questions.delete(requestId);
        return { rpcId: pending.rpcId, result: cancelledAnswer(pending) };
    }

    /* Every permission request and question still open, answered as cancelled, which the protocol asks of a client that cancels a turn. */
    cancelRequests(): Array<{ requestId: string; rpcId: number | string; result: unknown }> {
        const cancelled = [
            ...[...this.permissions].map(([requestId, pending]) => ({
                requestId,
                rpcId: pending.rpcId,
                result: { outcome: { outcome: 'cancelled' } } as unknown
            })),
            ...[...this.questions].map(([requestId, pending]) => ({ requestId, rpcId: pending.rpcId, result: cancelledAnswer(pending) }))
        ];
        this.permissions.clear();
        this.questions.clear();
        return cancelled;
    }

    hasPermission(requestId: string): boolean {
        return this.permissions.has(requestId);
    }

    hasQuestion(requestId: string): boolean {
        return this.questions.has(requestId);
    }

    /*
     * The end of a turn, from the `stopReason` of its `session/prompt` response. Only a turn the client cancelled
     * (`cancelled`) ends aborted: Grok 1.0.62 answers `cancelled` by itself when a person turns a call down, and
     * that ends its turn the way any answer does.
     */
    finish(result: unknown, promptId: string | undefined, cancelled = false): BackendEvent[] {
        const parsed = PromptResponseSchema.safeParse(result);
        const stopReason = parsed.success ? parsed.data.stopReason : 'end_turn';
        const reason = cancelled ? 'cancelled' : stopReason === 'cancelled' ? 'end_turn' : stopReason;
        this.refusalLine = false;
        const events = [...this.closeText(), ...this.closeThought(), ...this.vendorUsage(isRecord(result) ? result._meta : undefined)];
        const base = { ...(promptId === undefined ? {} : { promptId }), costUsd: this.costUsd };
        const quota = this.quota;
        this.quota = null;
        if (quota !== null && reason !== 'cancelled') {
            events.push({ type: 'turn.done', ...base, state: 'error', error: quota.text, limit: quotaLimit(quota) });
            return events;
        }
        if (quota !== null) {
            events.push({ type: 'text.done', ref: quota.ref, text: quota.text });
        }
        switch (reason) {
            case 'cancelled':
                events.push({ type: 'turn.done', ...base, state: 'aborted' });
                break;
            case 'refusal':
                events.push({ type: 'turn.done', ...base, state: 'error', error: this.words.refusal });
                break;
            case 'max_tokens':
                events.push({ type: 'note', level: 'warning', text: this.words.maxTokens }, { type: 'turn.done', ...base, state: 'done' });
                break;
            case 'max_turn_requests':
                events.push({ type: 'note', level: 'warning', text: this.words.maxTurnRequests }, { type: 'turn.done', ...base, state: 'done' });
                break;
            default:
                events.push({ type: 'turn.done', ...base, state: 'done' });
        }
        return events;
    }

    /* A turn that ended without a `stopReason`: the request failed, on a limit its error names, or was cancelled before the agent said so. */
    abort(promptId: string | undefined, error: string | null, limit: ChatTurnLimit | null = null): BackendEvent[] {
        this.refusalLine = false;
        const base = { ...(promptId === undefined ? {} : { promptId }), costUsd: this.costUsd };
        const events = [...this.closeText(), ...this.closeThought()];
        const quota = this.quota;
        this.quota = null;
        if (quota !== null) {
            events.push({ type: 'text.done', ref: quota.ref, text: quota.text });
        }
        // A failed request after the limit message still ran into that limit, so it pauses as one when the error names none.
        const named = limit ?? (quota === null ? null : quotaLimit(quota));
        events.push(
            error === null
                ? { type: 'turn.done', ...base, state: 'aborted' }
                : { type: 'turn.done', ...base, state: 'error', error, ...(named === null ? {} : { limit: named }) }
        );
        return events;
    }

    private messageChunk(update: Record<string, unknown>): BackendEvent[] {
        const chunk = ContentChunkSchema.safeParse(update);
        if (!chunk.success || chunk.data.content.type !== 'text' || chunk.data.content.text === undefined) {
            return [];
        }
        const messageId = chunk.data.messageId ?? null;
        const events = this.closeThought();
        if (this.text !== null && messageId !== null && this.text.messageId !== messageId) {
            events.push(...this.closeText());
        }
        if (this.text === null) {
            const ref = messageId === null ? `message-${++this.counter}` : `message-${messageId}`;
            this.text = { ref, messageId, text: '', held: true, afterRefusal: this.refusalLine };
            this.refusalLine = false;
        }
        const text = this.text;
        text.text += chunk.data.content.text;
        if (text.held && !withheld(text.text, text.afterRefusal)) {
            text.held = false;
            events.push({ type: 'text.delta', ref: text.ref, text: text.text });
        } else if (!text.held) {
            events.push({ type: 'text.delta', ref: text.ref, text: chunk.data.content.text });
        }
        return events;
    }

    private thoughtChunk(update: Record<string, unknown>): BackendEvent[] {
        const chunk = ContentChunkSchema.safeParse(update);
        if (!chunk.success || chunk.data.content.type !== 'text' || chunk.data.content.text === undefined) {
            return [];
        }
        const events = this.closeText();
        if (this.thought === null) {
            this.thought = { ref: `thought-${++this.counter}`, text: '' };
        }
        this.thought.text += chunk.data.content.text;
        events.push({ type: 'thinking.delta', ref: this.thought.ref, text: chunk.data.content.text });
        return events;
    }

    private closeText(): BackendEvent[] {
        const text = this.text;
        this.text = null;
        if (text === null || (text.held && text.afterRefusal && text.text === REFUSAL_LINE)) {
            return [];
        }
        if (text.held && text.text.startsWith(QUOTA_HEAD)) {
            this.quota = { ref: text.ref, text: text.text.trim(), resetsAt: quotaResetOf(text.text, this.now()) };
            return [];
        }
        return [{ type: 'text.done', ref: text.ref, text: text.text }];
    }

    private closeThought(): BackendEvent[] {
        const thought = this.thought;
        this.thought = null;
        return thought === null ? [] : [{ type: 'thinking.done', ref: thought.ref, text: thought.text }];
    }

    /* A tool call or an update to one; fields an update leaves out keep what the call said before, and a list it sends replaces the old one. */
    private toolCall(call: z.infer<typeof ToolCallSchema>, settle = true): BackendEvent[] {
        const known = this.tools.get(call.toolCallId);
        const tool: ToolState = known ?? {
            title: '',
            name: null,
            kind: null,
            status: null,
            rawInput: undefined,
            rawOutput: undefined,
            locations: [],
            diffs: [],
            text: [],
            shown: null,
            settled: false,
            refused: false
        };
        tool.title = call.title ?? tool.title;
        tool.name = call.name ?? tool.name;
        tool.kind = call.kind ?? tool.kind;
        tool.status = call.status ?? tool.status;
        tool.rawInput = call.rawInput ?? tool.rawInput;
        tool.rawOutput = call.rawOutput ?? tool.rawOutput;
        if (call.locations) {
            tool.locations = validItems(LocationSchema, call.locations).map((location) => location.path);
        }
        if (call.content) {
            tool.diffs = validItems(DiffSchema, call.content);
            tool.text = validItems(ToolContentSchema, call.content).flatMap((entry) =>
                entry.content.type === 'text' && entry.content.text ? [entry.content.text] : []
            );
        }
        this.tools.set(call.toolCallId, tool);
        const events: BackendEvent[] = [];
        const row = toolRow(tool.refused ? { ...tool, diffs: [] } : tool);
        const shown = JSON.stringify(row);
        if (shown !== tool.shown) {
            tool.shown = shown;
            events.push({
                type: 'tool.started',
                ref: call.toolCallId,
                name: row.name,
                input: row.input,
                parentRef: null,
                ...(row.changes ? { changes: row.changes } : {})
            });
        }
        if (settle && !tool.settled && (tool.status === 'completed' || tool.status === 'failed')) {
            tool.settled = true;
            events.push({
                type: 'tool.done',
                ref: call.toolCallId,
                output: toolOutput(tool),
                state: tool.status === 'completed' ? 'done' : 'error',
                ...(row.changes ? { changes: row.changes } : {})
            });
        }
        return events;
    }

    /* A plan is the whole list each time; it becomes a to-do row of its own, as a plan update in the thread. */
    private plan(update: Record<string, unknown>): BackendEvent[] {
        const entries = validItems(PlanEntrySchema, Array.isArray(update.entries) ? update.entries : []);
        const ref = `plan-${++this.counter}`;
        const todos = entries.map((entry) => ({
            content: entry.content,
            status: entry.status,
            activeForm: entry.content,
            ...(entry.priority ? { priority: entry.priority } : {})
        }));
        return [
            ...this.closeText(),
            ...this.closeThought(),
            { type: 'tool.started', ref, name: 'TodoWrite', input: { todos }, parentRef: null },
            { type: 'tool.done', ref, output: null, state: 'done' }
        ];
    }
}
