import type { AgentKind, ProviderCapabilities, ProviderInstall } from '@adecore/agent-contracts';
import type { BackendHost, BackendLaunch, ChatBackend } from '../chat/backend.ts';
import type { AccountReading } from './accounts/status.ts';
import type { ModelCatalog } from './catalog.ts';
import type { CliDetection } from './detect.ts';

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
    // The executable and its leading arguments.
    readonly command: string[];
    // What a terminal runs to continue one of this CLI's sessions; `{id}` stands for the session id.
    readonly resumeCommand: string;
    /* Whether `BackendLaunch.projectConfig: false` keeps this CLI from loading configuration out of the working folder; absent is no. */
    readonly ignoresProjectConfig?: boolean;
    /* Where this CLI keeps its login, settings and transcripts, which is what an account is. Absent on a
       CLI with no variable to move that folder, which then only has its default account. */
    readonly home?: ProviderHome;
    /* How a person installs this CLI and signs it in, for a page that shows it while the CLI is missing. */
    readonly install?: ProviderInstall;
    /* The arguments for one prompt in and one answer out, no session and no chat, which is how a
       host asks for a commit message or a title. Absent on a CLI that only runs interactively. */
    oneShotArgs?(prompt: string): string[];
    /* The same run with the prompt read from stdin, for a prompt too long for one argument (Linux
       refuses one past 128 KiB) or too private for the process list. Absent on a CLI that cannot. */
    readonly oneShotStdinArgs?: readonly string[];
    /* The arguments that start this CLI interactively on a first prompt and then keep the session. */
    firstPromptArgs(prompt: string): string[];
    detect(command: string, env: Record<string, string | undefined>): Promise<CliDetection>;
    // Whether a person turned this provider on, for one that is off until they do; absent is always on.
    enabled?(): boolean;
    /* Asks the CLI, started in an account's environment, who is signed in there. Absent leaves the host's own reader. */
    askAccount?(command: readonly string[], env: Record<string, string | undefined>): Promise<AccountReading>;
    /* Calls the listener whenever the models or the capabilities changed, for a provider that learns them from its CLI; answers how to stop. */
    onChange?(listener: () => void): () => void;
    createBackend(launch: BackendLaunch, host: BackendHost): ChatBackend;
}
