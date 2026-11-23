import { join } from 'node:path';
import { ModelOptionDescriptorSchema } from '@adecore/agent-contracts';
import { z } from 'zod';
import { olderThan, type AcpClientInfo } from '../backends/acp-backend.ts';
import type { AcpModeMap } from '../backends/acp-protocol.ts';
import { copilotMcpAllowArgs, copilotMcpArgs } from '../backends/cli-mcp.ts';
import type { SpawnChatProcess } from '../chat-process.ts';
import { runProcess } from '../run-process.ts';
import type { AccountReading } from './accounts/status.ts';
import type { AcpCatalogStore } from './acp-agent-state.ts';
import { createAcpProvider, type AcpProviderSpec } from './acp-provider.ts';
import antigravityModels from './antigravity-models.json' with { type: 'json' };
import { ModelCatalog } from './catalog.ts';
import copilotModels from './copilot-models.json' with { type: 'json' };
import { detectCli } from './detect.ts';
import grokModels from './grok-models.json' with { type: 'json' };
import type { ChatProvider, LaunchDecorator, ProviderHome } from './provider.ts';

/* What a host decides for every vendor ACP agent it starts. */
export interface AcpVendorOptions {
    // How the host names itself in `initialize`; absent sends the backend's default.
    readonly client?: AcpClientInfo;
    // The host's additions to every launch, such as its own MCP server.
    readonly launch?: LaunchDecorator;
    // Keeps the models the agent reported across a restart of the host.
    readonly catalogStore?: AcpCatalogStore;
}

interface CopilotProviderOptions extends AcpVendorOptions {
    // The folder every turn's usage is logged to (`copilotUsageDirectory`); absent logs nothing.
    readonly usageLog?: string;
}

interface AntigravityProviderOptions extends AcpVendorOptions {
    // The folder every turn's usage is logged to (`antigravityUsageDirectory`); absent logs nothing.
    readonly usageLog?: string;
    // How the version probe starts `agy`; absent spawns it.
    readonly spawn?: SpawnChatProcess;
}

type VendorSpec = Omit<AcpProviderSpec, 'catalog'>;

// The model these CLIs pick themselves; the agent is then left its own choice instead of being told one.
export const AGENT_DEFAULT_MODEL = 'default';

export function agentDefaultCatalog(): ModelCatalog {
    return new ModelCatalog({
        defaultModel: AGENT_DEFAULT_MODEL,
        profiles: { agent: { options: [], contextWindowTokens: {} } },
        models: [{ slug: AGENT_DEFAULT_MODEL, name: 'Default', profile: 'agent' }]
    });
}

/*
 * The models a built-in ACP agent offered when its manifest was written, under `AGENT_DEFAULT_MODEL`, until the agent
 * reports its own. The address book may hand a newer copy; what the agent reports lies over either.
 */
export function shippedAgentCatalog(kind: 'grok' | 'copilot' | 'antigravity'): ModelCatalog {
    // A JSON import widens the option types to string; the manifests pass the schema in `catalog.test.ts`.
    return new ModelCatalog({ grok: grokModels, copilot: copilotModels, antigravity: antigravityModels }[kind] as never);
}

export function agentModel(selection: { model: string }): string | null {
    return selection.model === AGENT_DEFAULT_MODEL ? null : selection.model;
}

/*
 * Grok's session modes (`default`, `plan`, `ask`) choose what a turn does, not what it may do without
 * asking, so only `supervised` names one; every wider runtime mode runs in `default` and the backend
 * answers the permission requests that mode allows. Ids from xai-org/grok-build (`SessionMode`).
 */
export const GROK_MODES: AcpModeMap = { supervised: ['default'] };

/*
 * Copilot's ACP modes are agent, plan and autopilot; autopilot keeps a turn going but still asks for
 * every tool (github/copilot-cli#2942), so it is no permission level and `supervised` names the agent mode.
 */
export const COPILOT_MODES: AcpModeMap = { supervised: ['https://agentclientprotocol.com/protocol/session-modes#agent'] };

/* The login Grok is asked to use: the key in the environment where there is one, else the one `grok login` left. */
export function grokAuthMethod(env: Record<string, string | undefined>): string {
    return env.XAI_API_KEY ? 'xai.api_key' : 'cached_token';
}

// A version probe must never be the start that updates the CLI; Grok and Copilot take the flag before anything else.
function probeWithoutUpdate(command: string, env: Record<string, string | undefined>) {
    return detectCli(command, env, undefined, ['--no-auto-update']);
}

function hostSpec(options: AcpVendorOptions): Pick<AcpProviderSpec, 'client' | 'catalogStore' | 'launch'> {
    return {
        ...(options.client === undefined ? {} : { client: options.client }),
        ...(options.catalogStore === undefined ? {} : { catalogStore: options.catalogStore }),
        ...(options.launch === undefined ? {} : { launch: options.launch })
    };
}

const GROK_SPEC: VendorSpec = {
    kind: 'grok',
    name: 'Grok',
    command: 'grok',
    // A chat must not wait on an update check; the flag belongs before the subcommand.
    args: ['--no-auto-update', 'agent', 'stdio'],
    model: agentModel,
    modes: GROK_MODES,
    loginHint: 'Run `grok login` in a terminal, or set `XAI_API_KEY`.',
    capabilities: { terminal: true, hooks: true, steer: true },
    steer: 'interject',
    resumeCommand: 'grok {flags} --resume {id}',
    home: { env: 'GROK_HOME', fallback: '.grok', loginEnv: ['XAI_API_KEY'], loginCommand: 'grok login' },
    install: {
        description: "xAI's coding agent, in a terminal and in a chat.",
        commands: {
            darwin: 'curl -fsSL https://x.ai/cli/install.sh | bash',
            linux: 'curl -fsSL https://x.ai/cli/install.sh | bash',
            win32: 'irm https://x.ai/cli/install.ps1 | iex'
        },
        guideUrl: 'https://github.com/xai-org/grok-build',
        signIn: [
            { kind: 'command', command: 'grok login' },
            { kind: 'env', variable: 'XAI_API_KEY' }
        ]
    },
    // Grok's own `--permission-mode` values (xai-org/grok-build); `bypassPermissions` is its always-approve.
    terminal: {
        modeArgs: {
            supervised: ['--permission-mode', 'default'],
            'auto-accept-edits': ['--permission-mode', 'acceptEdits'],
            auto: ['--permission-mode', 'auto'],
            'full-access': ['--permission-mode', 'bypassPermissions']
        }
    },
    detect: probeWithoutUpdate,
    // An ACP probe leaves a session folder in the account's home every time, so `grok models` answers instead (`askGrokModels`).
    accountProbe: false,
    // Headless Grok refuses every call that would ask, so the default mode keeps a title or a message from writing anything.
    oneShotArgs: (prompt) => ['--no-auto-update', '-p', prompt, '--output-format', 'plain', '--permission-mode', 'default', '--disallowed-tools', 'Agent'],
    leanOneShotArgs: (args, model) => [...args, '--model', model, '--tools', '', '--max-turns', '1', '--reasoning-effort', 'low'],
    firstPromptArgs: (prompt) => [prompt]
};

/* What `grok models` printed: who is signed in, and the models the account may use. */
interface GrokModels {
    signedIn: boolean;
    defaultModel: string | null;
    models: string[];
}

// The first line of `grok models` in Grok 1.0.62 for each way of being signed in, and for none.
const GROK_SIGNED_IN = [/^You are logged in with /, /^You are using XAI_API_KEY\b/, /^You are authenticated via /];
const GROK_SIGNED_OUT = /^You are not authenticated\b/;

/*
 * Reads `grok models` as Grok 1.0.62 prints it: the login on the first line, `Default model: <slug>`, then
 * `Available models:` with a line per model, `*` marking the default. A first line it does not know is no answer.
 */
export function readGrokModels(output: string): GrokModels {
    const lines = output.split('\n').map((line) => line.trimEnd());
    const first = lines.find((line) => line.trim() !== '')?.trim() ?? '';
    const signedIn = GROK_SIGNED_IN.some((pattern) => pattern.test(first));

    if (!signedIn && !GROK_SIGNED_OUT.test(first)) {
        throw new Error('Grok did not say who is signed in');
    }

    const named =
        lines
            .find((line) => line.startsWith('Default model:'))
            ?.slice('Default model:'.length)
            .trim() ?? '';

    const listedFrom = lines.findIndex((line) => line.trim() === 'Available models:');
    const models: string[] = [];
    let marked: string | null = null;

    for (const line of listedFrom === -1 ? [] : lines.slice(listedFrom + 1)) {
        const match = /^\s+([*-])\s+(\S+)/.exec(line);
        const slug = match?.[2];

        // A slug may reach a command line, so one that reads as a flag is left out.
        if (match === null || slug === undefined || slug.startsWith('-')) {
            continue;
        }

        models.push(slug);

        if (match[1] === '*') {
            marked = slug;
        }
    }

    const defaultModel = [named, marked].find((slug) => slug !== null && models.includes(slug)) ?? null;

    return { signedIn, defaultModel, models };
}

// What `grok models` gets before the read fails; it answers from the cache in under a second.
const GROK_ASK_TIMEOUT_MS = 20_000;

/* Asks `grok models` in the account's environment (`GROK_HOME`), which opens no session. */
async function askGrokModels(command: readonly string[], env: Record<string, string | undefined>): Promise<GrokModels> {
    const { exitCode, stdout, stderr } = await runProcess([command[0] ?? 'grok', '--no-auto-update', 'models'], {
        env,
        timeoutMs: GROK_ASK_TIMEOUT_MS,
        timeoutMessage: 'Grok did not answer in time'
    });

    if (exitCode !== 0) {
        throw new Error(stderr.trim() || `grok models exited with ${exitCode}`);
    }

    return readGrokModels(stdout);
}

// The part of an ACP catalog store's value that holds the models, as `AcpAgentState` writes it under `models`.
const StoredModelsSchema = z.object({
    defaultModel: z.string(),
    models: z.array(z.object({ slug: z.string(), name: z.string(), contextWindow: z.number().int().positive().optional() })),
    options: z.array(ModelOptionDescriptorSchema)
});
type StoredModels = z.infer<typeof StoredModelsSchema>;

function loadStored(store: AcpCatalogStore | undefined): Record<string, unknown> {
    try {
        const value = store?.load();

        return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/*
 * Lays the models `grok models` listed over the catalog and the store the way a chat's session would, keeping the
 * names, context windows and reasoning effort a chat learned, which the list does not print. Answers whether the models changed.
 */
export function adoptGrokModels(catalog: ModelCatalog, store: AcpCatalogStore | undefined, listed: GrokModels): boolean {
    if (listed.defaultModel === null) {
        return false;
    }

    const stored = loadStored(store);
    const known = StoredModelsSchema.safeParse(stored.models);
    const learned = new Map((known.success ? known.data.models : catalog.list()).map((model) => [model.slug, model]));

    const models: StoredModels['models'] = listed.models.map((slug) => {
        const model = learned.get(slug);
        const contextWindow = model !== undefined && 'contextWindow' in model ? model.contextWindow : undefined;

        return { slug, name: model?.name ?? slug, ...(contextWindow === undefined ? {} : { contextWindow }) };
    });

    const options = known.success ? known.data.options : [];
    const changed = catalog.adopt(models, listed.defaultModel, options);

    if (changed) {
        try {
            store?.save({ ...stored, models: { defaultModel: listed.defaultModel, models, options } });
        } catch {
            // A store that cannot write costs the next start this list, never this reading.
        }
    }

    return changed;
}

/* Lays the capabilities one provider learned over another's, in place, since a host may hold the object itself. */
function copyCapabilities(target: ChatProvider, source: ChatProvider): void {
    const capabilities = target.capabilities as unknown as Record<string, unknown>;

    for (const key of Object.keys(capabilities)) {
        delete capabilities[key];
    }

    Object.assign(capabilities, source.capabilities);
}

/*
 * Grok's login follows the launch's environment, so a chat runs on the provider of its login: the stored one or the key.
 * Both share the catalog and the store, and what either learns is laid over the listed one and told to its listeners.
 */
export function createGrokProvider(options: AcpVendorOptions = {}): ChatProvider {
    const catalog = shippedAgentCatalog('grok');
    const listeners = new Set<() => void>();
    const byLogin = new Map<string, ChatProvider>();

    const notify = (): void => {
        for (const listener of [...listeners]) {
            listener();
        }
    };

    const learned = (source: ChatProvider): void => {
        if (source !== listed) {
            copyCapabilities(listed, source);
        }

        notify();
    };

    const forLogin = (authMethod: string): ChatProvider => {
        const known = byLogin.get(authMethod);

        if (known !== undefined) {
            return known;
        }

        const provider = createAcpProvider({ ...GROK_SPEC, catalog, authMethod, ...hostSpec(options) });
        provider.onChange?.(() => learned(provider));
        byLogin.set(authMethod, provider);

        return provider;
    };

    const listed = forLogin(grokAuthMethod({}));

    return {
        ...listed,
        onChange: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        askAccount: async (command, env): Promise<AccountReading> => {
            const listed = await askGrokModels(command, env);

            // Signed out, Grok still lists models, which are not the account's.
            if (listed.signedIn && adoptGrokModels(catalog, options.catalogStore, listed)) {
                notify();
            }

            return { signedIn: listed.signedIn, email: null, plan: null, organization: null };
        },
        createBackend: (backendLaunch, host) => forLogin(grokAuthMethod(backendLaunch.env)).createBackend(backendLaunch, host)
    };
}

const COPILOT_ONE_SHOT = ['-s', '--no-ask-user', '--deny-tool=shell, write'];

const COPILOT_SPEC: VendorSpec = {
    kind: 'copilot',
    name: 'GitHub Copilot',
    command: 'copilot',
    args: ['--acp', '--stdio', '--no-auto-update'],
    model: agentModel,
    modes: COPILOT_MODES,
    loginHint: 'Run `copilot login` in a terminal.',
    capabilities: { terminal: true, hooks: true },
    resumeCommand: 'copilot {flags} --resume={id}',
    detect: probeWithoutUpdate,
    install: {
        description: "GitHub's coding agent, in a terminal and in a chat.",
        commands: { darwin: 'npm install -g @github/copilot', linux: 'npm install -g @github/copilot', win32: 'npm install -g @github/copilot' },
        guideUrl: 'https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli',
        signIn: [
            { kind: 'command', command: 'copilot login' },
            { kind: 'env', variable: 'COPILOT_GITHUB_TOKEN' }
        ]
    },
    terminal: { mcpArgs: copilotMcpArgs, mcpAllowArgs: copilotMcpAllowArgs },
    // Its permission requests name no server, so only an `--allow-tool=<server>` on its line runs a server's tools
    // without asking (measured on Copilot CLI 1.0.104).
    allowToolsArgs: copilotMcpAllowArgs,
    // `-s` prints only the answer; without shell and file writes it can only read. A prompt piped in runs the same way.
    oneShotArgs: (prompt) => ['--no-auto-update', '-p', prompt, ...COPILOT_ONE_SHOT],
    oneShotStdinArgs: ['--no-auto-update', ...COPILOT_ONE_SHOT],
    // `-p` answers and exits; `-i` runs the prompt and stays.
    firstPromptArgs: (prompt) => ['-i', prompt]
};

/* Where every Copilot turn's usage is logged under a host's data folder: its CLI keeps no file a usage page can read. */
export function copilotUsageDirectory(home: string): string {
    return join(home, 'usage', 'copilot');
}

export function createCopilotProvider(options: CopilotProviderOptions = {}): ChatProvider {
    return createAcpProvider({
        ...COPILOT_SPEC,
        catalog: shippedAgentCatalog('copilot'),
        ...hostSpec(options),
        ...(options.usageLog === undefined ? {} : { usageLog: options.usageLog })
    });
}

// Google's CLI, which a terminal starts and a single prompt goes to; `agy acp` runs its chats.
const ANTIGRAVITY_CLI = 'agy';

// The release the chats were recorded against; an older `agy` has no `agy acp` that behaves the same.
const ANTIGRAVITY_MIN_VERSION = '1.5.15';

// An `agy` the host starts must never update itself: an update signs out every `agy` on the machine. A terminal is the person's.
const ANTIGRAVITY_ENV = { AGY_CLI_DISABLE_AUTO_UPDATE: '1' };

const ANTIGRAVITY_UPDATE_HINT = `Antigravity chats need agy ${ANTIGRAVITY_MIN_VERSION} or newer. Update agy in a terminal; the update signs out every agy on this machine.`;

/*
 * agy 1.5's session modes (`default`, `accept-edits`, `auto`, `plan`). Full access runs in `default` and the backend
 * answers every request itself, so no agent mode decides on its own what a full-access chat may do.
 */
const ANTIGRAVITY_MODES: AcpModeMap = {
    supervised: ['default'],
    'auto-accept-edits': ['accept-edits'],
    auto: ['auto'],
    'full-access': ['default']
};

/*
 * `agy` keeps its sessions and its sign-in under `GEMINI_HOME` (`~/.gemini` without it), so an account is
 * a folder of its own there. A chat signs it in through ACP `authenticate` where a browser can open; where none
 * can, `agy acp --login` in a terminal prints a link and waits for the code (agy 1.5.15).
 */
const ANTIGRAVITY_HOME: ProviderHome = { env: 'GEMINI_HOME', fallback: '.gemini', loginEnv: [], loginCommand: 'agy acp --login' };

const ANTIGRAVITY_SPEC: VendorSpec = {
    kind: 'antigravity',
    name: 'Antigravity',
    command: ANTIGRAVITY_CLI,
    args: ['acp'],
    env: ANTIGRAVITY_ENV,
    mcp: { http: true },
    // agy 1.5's own `--mode` values; plan mode widens nothing.
    terminal: {
        modeArgs: {
            supervised: [],
            'auto-accept-edits': ['--mode=accept-edits'],
            auto: ['--mode=auto'],
            'full-access': ['--dangerously-skip-permissions']
        }
    },
    oneShotArgs: antigravityOneShotArgs,
    // Every `agy -p` stays in the person's own conversation list, so it is the last CLI asked and names no chat.
    oneShotApart: true,
    oneShotEnv: ANTIGRAVITY_ENV,
    model: agentModel,
    modes: ANTIGRAVITY_MODES,
    // agy runs the browser sign-in itself, on a callback server of its own.
    authMethod: 'oauth-personal',
    loginHint: 'Run `agy acp --login` in a terminal on this machine, then send your message again.',
    capabilities: { terminal: true, hooks: true, steer: true },
    steer: 'prompt',
    repliesEndOnUsage: true,
    cancelsIdle: true,
    mcpToolPrefix: 'mcp_',
    daemonFlag: 'IsDaemon',
    minVersion: { version: ANTIGRAVITY_MIN_VERSION, updateHint: ANTIGRAVITY_UPDATE_HINT },
    resumeCommand: 'agy {flags} --conversation {id}',
    home: ANTIGRAVITY_HOME,
    install: {
        description: "Google's coding agent, in a terminal and in a chat.",
        commands: {
            darwin: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
            linux: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
            win32: 'irm https://antigravity.google/cli/install.ps1 | iex'
        },
        guideUrl: 'https://antigravity.google/docs/cli',
        // A chat's first turn signs it in in the browser; without one, the command does.
        signIn: [{ kind: 'chat' }, { kind: 'command', command: 'agy acp --login' }]
    },
    // agy reads a prompt only from `-p` (answers and exits), `-i` (runs it and stays) or stdin.
    firstPromptArgs: (prompt) => ['-i', prompt]
};

/*
 * A single prompt to `agy`. Headless it soft-denies every call that would ask (antigravity.google/docs/cli/headless),
 * so it reads and answers.
 */
export function antigravityOneShotArgs(prompt: string): string[] {
    return ['-p', prompt, '--output-format', 'text'];
}

/*
 * Where every Antigravity turn's usage is logged under a host's data folder. agy keeps its conversations in a format of
 * its own, so the log counts the turns from its prompt responses, under the model the session ran.
 */
export function antigravityUsageDirectory(home: string): string {
    return join(home, 'usage', 'antigravity');
}

/*
 * Antigravity is installed once `agy` is, which is all its terminal needs. Its chats run on `agy acp`, so an `agy`
 * the version probe found older than the floor offers no chat and starts none.
 */
export function createAntigravityProvider(options: AntigravityProviderOptions = {}): ChatProvider {
    const base = createAcpProvider({
        ...ANTIGRAVITY_SPEC,
        catalog: shippedAgentCatalog('antigravity'),
        ...hostSpec(options),
        ...(options.usageLog === undefined ? {} : { usageLog: options.usageLog })
    });

    let version: string | null = null;
    const tooOld = (): boolean => version !== null && olderThan(version, ANTIGRAVITY_MIN_VERSION);

    return {
        ...base,
        get capabilities() {
            return tooOld() ? { ...base.capabilities, chat: false } : base.capabilities;
        },
        detect: async (command, env) => {
            const detection = await detectCli(command, { ...env, ...ANTIGRAVITY_ENV }, options.spawn);
            version = detection.installed ? detection.version : null;

            return detection;
        },
        refreshModels: async (command, env, refresh) => (tooOld() ? false : ((await base.refreshModels?.(command, env, refresh)) ?? false)),
        createBackend: (backendLaunch, host) => {
            if (tooOld()) {
                throw new Error(ANTIGRAVITY_UPDATE_HINT);
            }

            return base.createBackend(backendLaunch, host);
        }
    };
}
