import type { AgentKind, ProviderCapabilities, ProviderInstall, RuntimeMode } from '@adecore/agent-contracts';
import type { BackendHost, BackendLaunch, ChatBackend } from '../backends/backend.ts';
import type { CliMcpServer } from '../backends/cli-mcp.ts';
import type { ProbeResult } from '../backends/limits-probe.ts';
import type { ProviderThreads } from '../backends/threads.ts';
import type { AccountReading } from './accounts/status.ts';
import type { ModelCatalog } from './catalog.ts';
import type { CliDetection } from './detect.ts';

/*
 * What an extra account may take from the default account of its CLI. A closed list: nothing the CLI
 * keeps for a login, a history or a plugin is ever named here, so none of it can be shared by accident.
 */
export interface ProviderShare {
    // Entries of the config folder an extra account links to the default folder's entry of that name.
    readonly links: readonly string[];
    // A settings file copied once, by the keys listed; every other key stays behind, whatever it holds.
    readonly seed: { readonly file: string; readonly keys: readonly string[] };
}

export interface ProviderHome {
    // The variable the CLI reads its config folder from.
    readonly env: string;
    // The folder it uses without that variable, under the person's home.
    readonly fallback: string;
    // Variables that sign the CLI in on their own, over whatever login the folder holds.
    readonly loginEnv: readonly string[];
    // What a person types in a terminal to sign in; the account's folder comes from the terminal's environment.
    // Absent on a CLI that signs in from its first chat, which nothing outside that chat can ask about.
    readonly loginCommand?: string;
    // True when an account of this CLI is a shadow home over the CLI's own folder, so its threads go on under the other.
    readonly shadow?: boolean;
    // What an extra account can share with the default one; absent on a CLI that shares nothing this way.
    readonly share?: ProviderShare;
}

export interface ClaudeCodeRuntime {
    // The CLI's configuration folder, for chats that run in one of their own (`CLAUDE_CONFIG_DIR`); absent is the account's.
    readonly configDir?: string;
}

/* Where a CLI keeps the whole conversation of a subagent: Claude Code's transcript files, or the threads of Codex's app-server. */
export type SubagentSource = 'claude-transcript' | 'codex-thread';

/* The host's additions to a launch, applied to every start of a CLI before its backend is made. */
export type LaunchDecorator = (launch: BackendLaunch) => BackendLaunch;

/* How a terminal starts this CLI, which the host builds a line from. */
export interface ProviderTerminal {
    // The flags that set a runtime mode. A mode without flags starts bare, which leaves the CLI's own default in place.
    readonly modeArgs?: Readonly<Record<RuntimeMode, readonly string[]>>;
    // The flag that names a model, for a CLI whose catalog a person picks from.
    readonly modelFlag?: string;
    mcpArgs?(server: CliMcpServer): string[];
    // The arguments that run every tool of a server without a prompt.
    mcpAllowArgs?(serverName: string): string[];
    // The arguments that carry a note for the agent on a fresh start, where the CLI takes one there.
    noteArgs?(note: string): string[];
    // Arguments on every line, such as a flag only a newer version takes; known after `prepare`.
    extraArgs?(): readonly string[];
    // Asks the installed CLI what it takes, before the first line is built.
    prepare?(): Promise<void>;
}

export function runsClaudeCode(provider: Pick<ChatProvider, 'claudeCode'>): boolean {
    return provider.claudeCode !== undefined;
}

/* The CLI itself, which a terminal and a single prompt start: `executable`, else the provider's command. */
export function cliExecutable(provider: Pick<ChatProvider, 'command' | 'executable'>): string {
    return provider.executable ?? provider.command[0]!;
}

/*
 * One agent CLI as a host knows it. Everything a provider does differently is either data on
 * this value or behind the backend it makes, so a new CLI is a value plus a backend and nothing
 * else changes: the session, the projector, the manager and the wire stay as they are.
 */
export interface ChatProvider {
    readonly kind: AgentKind;
    readonly name: string;
    readonly catalog: ModelCatalog;
    readonly capabilities: ProviderCapabilities;
    readonly command: string[];
    /* The CLI a terminal and a single prompt start, where `command` is a chat server of its own; absent is `command[0]`. */
    readonly executable?: string;
    // What a terminal runs to continue one of this CLI's sessions; `{id}` stands for the session id.
    readonly resumeCommand: string;
    /* Whether `BackendLaunch.projectConfig: false` keeps this CLI from loading configuration out of the working folder; absent is no. */
    readonly ignoresProjectConfig?: boolean;
    /* Where this CLI keeps its login, settings and transcripts, which is what an account is. Absent on a
       CLI with no variable to move that folder, which then only has its default account. */
    readonly home?: ProviderHome;
    /* Set on a provider whose chats run Claude Code, under any kind: it opens a turn of its own once background work
       ended, and keeps transcripts that subagents, titles and orphaned rows are read from. */
    readonly claudeCode?: ClaudeCodeRuntime;
    /* Where the whole conversation of a subagent is read from; absent on a CLI that keeps none apart from its chat's thread. */
    readonly subagentSource?: SubagentSource;
    /* Set on a CLI that keeps a chat in threads of an app-server, which can then be listed and forked without a chat running. */
    readonly threads?: ProviderThreads;
    /* How a person installs this CLI and signs it in, for a page that shows it while the CLI is missing. */
    readonly install?: ProviderInstall;
    /* How a terminal starts this CLI; absent on a CLI that only runs as a chat. */
    readonly terminal?: ProviderTerminal;
    /* The host's additions to a launch (an MCP server, extra arguments), applied by whoever starts a backend from this provider. */
    readonly launch?: LaunchDecorator;
    /* The arguments for one prompt in and one answer out, no session and no chat, which is how a
       host asks for a commit message or a title. Absent on a CLI that only runs interactively. */
    oneShotArgs?(prompt: string): string[];
    /* Set on a CLI whose single prompt runs apart from its chats: it answers one first only for its own kind, after
       every other CLI otherwise, and it names no chat. */
    readonly oneShotApart?: boolean;
    /* The same run with the prompt read from stdin, for a prompt too long for one argument (Linux
       refuses one past 128 KiB) or too private for the process list. Absent on a CLI that cannot. */
    readonly oneShotStdinArgs?: readonly string[];
    /* A one-shot run's arguments made short and cheap for a model asked for an answer alone: the model, no tools, little effort. Absent only names the model. */
    leanOneShotArgs?(args: readonly string[], model: string): string[];
    /* The arguments that start this CLI interactively on a first prompt and then keep the session. */
    firstPromptArgs(prompt: string): string[];
    detect(command: string, env: Record<string, string | undefined>): Promise<CliDetection>;
    // Whether a person turned this provider on, for one that is off until they do; absent is always on.
    enabled?(): boolean;
    /* Asks the CLI, started in an account's environment, who is signed in there. Absent on a CLI that cannot say, whose accounts the host then lists as logins it cannot check. */
    askAccount?(command: readonly string[], env: Record<string, string | undefined>): Promise<AccountReading>;
    /* Asks the CLI what is left of the plan it runs on. Absent leaves the plan to the host's own reader. */
    probeLimits?(command: readonly string[], env: Record<string, string>): Promise<ProbeResult>;
    /* Puts what the host needs in a config folder of this CLI (rules for its commands, hooks); absent puts nothing there. */
    prepareHome?(folder: string): Promise<void>;
    /* Calls the listener whenever the models or the capabilities changed, for a provider that learns them from its CLI; answers how to stop. */
    onChange?(listener: () => void): () => void;
    createBackend(launch: BackendLaunch, host: BackendHost): ChatBackend;
}
