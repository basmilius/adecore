import { codexMcpArgs } from '../backends/cli-mcp.ts';
import { CodexBackend } from '../backends/codex-backend.ts';
import { codexThreads } from '../backends/codex-threads.ts';
import type { CodexClientInfo } from '../backends/codex-transport.ts';
import { CODEX_CAPABILITIES, CODEX_CHAT_ARGS, CODEX_RESUME_COMMAND } from '../backends/codex.ts';
import { probeCodex } from '../backends/limits-probe.ts';
import { errorText } from '../error-text.ts';
import { runProcess } from '../run-process.ts';
import { askCodexAccount } from './accounts/status.ts';
import { ModelCatalog } from './catalog.ts';
import codexManifest from './codex-models.json' with { type: 'json' };
import { codexRulesPathIn, installCodexRules, type CodexRules } from './codex-rules.ts';
import { detectCli } from './detect.ts';
import type { ChatProvider, LaunchDecorator, ProviderTerminal } from './provider.ts';

// A hanging CLI must not hold its terminal launch indefinitely.
const HELP_TIMEOUT_MS = 5_000;

export interface CodexProviderOptions {
    // How the host names itself in the `initialize` of every app-server this provider opens.
    client: CodexClientInfo;
    // What starts the app-server, when it is not `codex app-server` on the path: a fake in a test.
    command?: string[];
    // The host's additions to every launch, such as its MCP server.
    launch?: LaunchDecorator;
    // The commands Codex runs outside its sandbox without asking, written in the config folder of every account.
    rules?: CodexRules;
    // What `codex --help` prints, for the terminal flags a newer Codex takes; a test answers without starting anything.
    help?: (executable: string) => Promise<string>;
}

async function codexHelp(executable: string): Promise<string> {
    return (await runProcess([executable, '--help'], { timeoutMs: HELP_TIMEOUT_MS })).stdout;
}

/*
 * Codex 0.157 runs a session in a shared background server unless told not to, and that server runs the hooks with the
 * environment of whichever terminal started it: another node's token, or one a restarted host no longer knows. An older
 * Codex refuses the flag, so it rides only once `--help` names it.
 */
function codexTerminal(executable: string, help: (executable: string) => Promise<string>): ProviderTerminal {
    let noDaemon = false;
    let asked: Promise<void> | null = null;

    return {
        // Codex 0.153 takes only `on-request` and `never` on `--ask-for-approval`, so the three modes that still ask share one policy; the sandbox is what full access widens.
        modeArgs: {
            supervised: ['--ask-for-approval', 'on-request', '--sandbox', 'workspace-write'],
            'auto-accept-edits': ['--ask-for-approval', 'on-request', '--sandbox', 'workspace-write'],
            auto: ['--ask-for-approval', 'on-request', '--sandbox', 'workspace-write'],
            'full-access': ['--ask-for-approval', 'never', '--sandbox', 'danger-full-access']
        },
        modelFlag: '--model',
        mcpArgs: (server) => codexMcpArgs(server),
        // Codex parses a `-c` value as TOML, and a JSON string is a valid TOML basic string. Only a fresh launch carries it:
        // Codex 0.154 ignores developer instructions on a resume (measured) and keeps those the session started with.
        noteArgs: (note) => ['-c', `developer_instructions=${JSON.stringify(note)}`],
        extraArgs: () => (noDaemon ? ['--no-daemon'] : []),
        // Asked once: a Codex that is not there, or does not answer in time, takes nothing.
        prepare: () =>
            (asked ??= help(executable)
                .catch(() => '')
                .then((text) => {
                    noDaemon = text.includes('--no-daemon');
                }))
    };
}

export function createCodexProvider(options: CodexProviderOptions): ChatProvider {
    const { client, command, launch, rules } = options;
    const chatCommand = command ?? ['codex', ...CODEX_CHAT_ARGS];

    return {
        kind: 'codex',
        name: 'Codex',
        catalog: new ModelCatalog(codexManifest as never),
        capabilities: CODEX_CAPABILITIES,
        command: chatCommand,
        resumeCommand: CODEX_RESUME_COMMAND,
        // A folder's `.codex` layer loads once the person's own config trusts the folder or its repository, which a worktree inherits;
        // neither `-c` nor `project_root_markers` turns it off, and `--disable hooks` would take the person's hooks along (Codex 0.162.1).
        ignoresProjectConfig: false,
        subagentSource: 'codex-thread',
        threads: codexThreads(client),
        titleFromOneShot: true,
        ...(launch === undefined ? {} : { launch }),
        // The auth variables Codex 0.157 names in its own "no Codex credentials were found" advice.
        home: {
            env: 'CODEX_HOME',
            fallback: '.codex',
            loginEnv: ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'],
            loginCommand: 'codex login',
            shadow: true
        },
        install: {
            description: "OpenAI's coding agent, in a terminal and in a chat.",
            commands: { darwin: 'npm install -g @openai/codex', linux: 'npm install -g @openai/codex', win32: 'npm install -g @openai/codex' },
            guideUrl: 'https://github.com/openai/codex',
            signIn: [
                { kind: 'command', command: 'codex login' },
                { kind: 'env', variable: 'OPENAI_API_KEY' }
            ]
        },
        terminal: codexTerminal(chatCommand[0]!, options.help ?? codexHelp),
        detect: detectCli,
        askAccount: (path, env) => askCodexAccount(path, env, client),
        probeLimits: (path, env) => probeCodex(path, env, client),
        ...(rules === undefined
            ? {}
            : {
                  // A folder the rule cannot be written to only costs an approval per call, so it never stops the host.
                  prepareHome: async (folder: string): Promise<void> => {
                      const path = codexRulesPathIn(folder, rules);
                      await installCodexRules(path, rules).catch((e: unknown) => console.error(`Could not write the codex rules in ${path}:`, errorText(e)));
                  }
              }),
        // Read-only and without an approval to wait for: the run only has to read what it is handed. A chat's
        // title is asked in a folder that need not be a repository, and ephemeral keeps the run out of Codex's thread list.
        oneShotArgs: (prompt) => ['exec', '--color', 'never', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', prompt],
        // A prompt of `-` is read from stdin.
        oneShotStdinArgs: ['exec', '--color', 'never', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-'],
        // The stdin marker is positional, so the model goes before it.
        leanOneShotArgs: (args, model) => {
            const at = args.at(-1) === '-' ? args.length - 1 : args.length;

            return [args[0]!, '-c', 'model_reasoning_effort="low"', ...args.slice(1, at), '--model', model, ...args.slice(at)];
        },
        // `codex [OPTIONS] [PROMPT]`: the positional starts the interactive session on that prompt.
        firstPromptArgs: (prompt) => [prompt],
        createBackend: (launched, host) => new CodexBackend(launched, host, { client })
    };
}
