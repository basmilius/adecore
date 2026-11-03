import { ClaudeBackend, type ClaudeBackendOptions } from '../chat/claude-backend.ts';
import { ModelCatalog } from './catalog.ts';
import { CLAUDE_CAPABILITIES, CLAUDE_RESUME_COMMAND } from './claude.ts';
import { detectCli } from './detect.ts';
import type { ChatProvider } from './provider.ts';

export function createClaudeProvider(options: ClaudeBackendOptions = {}): ChatProvider {
    return {
        kind: 'claude',
        name: 'Claude Code',
        catalog: new ModelCatalog(),
        capabilities: CLAUDE_CAPABILITIES,
        command: ['claude'],
        resumeCommand: CLAUDE_RESUME_COMMAND,
        ignoresProjectConfig: true,
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
        // The version probe must never be the start that updates the CLI.
        detect: (command, env) => detectCli(command, { ...env, DISABLE_AUTOUPDATER: '1' }),
        oneShotArgs: (prompt) => ['-p', prompt, '--output-format', 'text'],
        // `-p` without a prompt argument reads the prompt from stdin.
        oneShotStdinArgs: ['-p', '--output-format', 'text'],
        // `claude [options] [prompt]`: the prompt is the positional, and without -p the session stays.
        firstPromptArgs: (prompt) => [prompt],
        createBackend: (launch, host) => new ClaudeBackend(launch, host, options)
    };
}

export const claudeProvider = createClaudeProvider();
