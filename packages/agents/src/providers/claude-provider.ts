import { ClaudeBackend, type ClaudeBackendOptions } from '../backends/claude-backend.ts';
import { CLAUDE_CAPABILITIES, CLAUDE_RESUME_COMMAND } from '../backends/claude.ts';
import { claudeMcpAllowArgs, claudeMcpArgs } from '../backends/cli-mcp.ts';
import { probeClaude } from '../backends/limits-probe.ts';
import { askClaudeAccount } from './accounts/status.ts';
import { ModelCatalog } from './catalog.ts';
import { detectCli } from './detect.ts';
import type { ChatProvider, LaunchDecorator } from './provider.ts';

export interface ClaudeProviderOptions extends ClaudeBackendOptions {
    // What starts Claude Code, when it is not the `claude` on the path: a fake in a test, or the host's own flags.
    command?: string[];
    // The host's additions to every launch, such as its MCP server.
    launch?: LaunchDecorator;
}

export function createClaudeProvider(options: ClaudeProviderOptions = {}): ChatProvider {
    const { command, launch, ...backend } = options;

    return {
        kind: 'claude',
        name: 'Claude Code',
        catalog: new ModelCatalog(),
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
            loginCommand: 'claude auth login'
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
        detect: (path, env) => detectCli(path, { ...env, DISABLE_AUTOUPDATER: '1' }),
        askAccount: askClaudeAccount,
        probeLimits: probeClaude,
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
        createBackend: (launched, host) => new ClaudeBackend(launched, host, backend)
    };
}
