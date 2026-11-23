import type { ModelInfo } from '@adecore/agent-contracts';
import { ClaudeBackend, type ClaudeBackendOptions } from '../backends/claude-backend.ts';
import { CLAUDE_CAPABILITIES, CLAUDE_RESUME_COMMAND } from '../backends/claude.ts';
import { claudeMcpAllowArgs, claudeMcpArgs } from '../backends/cli-mcp.ts';
import { probeClaude, type ClaudeEffortCapSource } from '../backends/limits-probe.ts';
import type { SpawnChatProcess } from '../chat-process.ts';
import { askClaudeAccount } from './accounts/status.ts';
import { ModelCatalog } from './catalog.ts';
import { capEffortChoices } from './claude-effort-cap.ts';
import { detectCli } from './detect.ts';
import type { ChatProvider, LaunchDecorator } from './provider.ts';

interface ClaudeProviderOptions extends ClaudeBackendOptions {
    // What starts Claude Code, when it is not the `claude` on the path: a fake in a test, or the host's own flags.
    command?: string[];
    // The host's additions to every launch, such as its MCP server.
    launch?: LaunchDecorator;
    // What starts the limits probe's process: a fake in a test.
    probeSpawn?: SpawnChatProcess;
}

/* The catalog with the effort caps the limits probe last read laid over its labels. */
class CappedModelCatalog extends ModelCatalog {
    private readonly caps: () => ClaudeEffortCapSource[];

    constructor(caps: () => ClaudeEffortCapSource[]) {
        super();
        this.caps = caps;
    }

    override list(): ModelInfo[] {
        return capEffortChoices(super.list(), this.caps(), (alias) => this.resolveModel(alias));
    }
}

export function createClaudeProvider(options: ClaudeProviderOptions = {}): ChatProvider {
    const { command, launch, probeSpawn, ...backend } = options;
    // The version the registry's last probe read, so a running chat can tell it was started on an older binary.
    let version: string | null = null;
    // Per config folder, so each account's user settings count once; the picker is shared, so the lowest of them all labels it.
    const caps = new Map<string, ClaudeEffortCapSource[]>();
    const listeners = new Set<() => void>();
    const catalog = new CappedModelCatalog(() => [...caps.values()].flat());

    const takeCaps = (env: Record<string, string>, sources: ClaudeEffortCapSource[]): void => {
        const before = JSON.stringify(catalog.list());
        caps.set(env.CLAUDE_CONFIG_DIR ?? '', sources);

        if (JSON.stringify(catalog.list()) !== before) {
            for (const listener of [...listeners]) {
                listener();
            }
        }
    };

    return {
        kind: 'claude',
        name: 'Claude Code',
        catalog,
        capabilities: CLAUDE_CAPABILITIES,
        command: command ?? ['claude'],
        resumeCommand: CLAUDE_RESUME_COMMAND,
        ignoresProjectConfig: true,
        claudeCode: backend.apiKey ? { configDir: backend.apiKey.configDir } : {},
        subagentSource: 'claude-transcript',
        ...(launch === undefined ? {} : { launch }),
        // Read from the strings of Claude Code 2.1.282; never HOME, which moves the keychain lookup along with it.
        home: {
            env: 'CLAUDE_CONFIG_DIR',
            fallback: '.claude',
            loginEnv: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'],
            loginCommand: 'claude auth login',
            // An allow list, read from the strings of Claude Code 2.1.322. `settings.json` can hold a login (`env`, `apiKeyHelper`), so it is copied by key and never linked.
            share: {
                links: ['CLAUDE.md', 'rules', 'skills', 'agents', 'commands', 'output-styles'],
                seed: { file: 'settings.json', keys: ['permissions', 'hooks', 'model', 'statusLine', 'outputStyle'] }
            }
        },
        install: {
            description: "Anthropic's coding agent, in a terminal and in a chat.",
            commands: {
                darwin: 'curl -fsSL https://claude.ai/install.sh | bash',
                linux: 'curl -fsSL https://claude.ai/install.sh | bash',
                win32: 'irm https://claude.ai/install.ps1 | iex'
            },
            guideUrl: 'https://docs.anthropic.com/en/docs/claude-code/setup',
            signIn: [
                { kind: 'command', command: 'claude auth login' },
                { kind: 'env', variable: 'ANTHROPIC_API_KEY' }
            ]
        },
        terminal: {
            // Supervised names `default`, since a bare launch takes the `defaultMode` from a person's settings, which can be `auto`.
            modeArgs: {
                supervised: ['--permission-mode', 'default'],
                'auto-accept-edits': ['--permission-mode', 'acceptEdits'],
                auto: ['--permission-mode', 'auto'],
                'full-access': ['--permission-mode', 'bypassPermissions']
            },
            modelFlag: '--model',
            mcpArgs: claudeMcpArgs,
            mcpAllowArgs: claudeMcpAllowArgs
        },
        // The version probe must never be the start that updates the CLI.
        detect: async (path, env) => {
            const detection = await detectCli(path, { ...env, DISABLE_AUTOUPDATER: '1' });
            version = detection.installed ? detection.version : null;

            return detection;
        },
        askAccount: askClaudeAccount,
        probeLimits: (probeCommand, env) =>
            probeClaude(probeCommand, env, { ...(probeSpawn ? { spawn: probeSpawn } : {}), onEffortCaps: (sources) => takeCaps(env, sources) }),
        onChange: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        oneShotArgs: (prompt) => ['-p', prompt, '--output-format', 'text'],
        // `-p` without a prompt argument reads the prompt from stdin.
        oneShotStdinArgs: ['-p', '--output-format', 'text'],
        leanOneShotArgs: (args, model) => [
            ...args,
            '--model',
            model,
            '--tools',
            '',
            '--strict-mcp-config',
            '--setting-sources',
            '',
            '--no-session-persistence',
            '--effort',
            'low'
        ],
        // `claude [options] [prompt]`: the prompt is the positional, and without -p the session stays.
        firstPromptArgs: (prompt) => [prompt],
        createBackend: (launched, host) => new ClaudeBackend(launched, host, { installedVersion: () => version, ...backend })
    };
}
