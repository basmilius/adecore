import { CodexBackend, type CodexBackendOptions } from '../backends/codex-backend.ts';
import { CODEX_CAPABILITIES, CODEX_CHAT_ARGS, CODEX_RESUME_COMMAND } from '../backends/codex.ts';
import { ModelCatalog } from './catalog.ts';
import codexManifest from './codex-models.json' with { type: 'json' };
import { detectCli } from './detect.ts';
import type { ChatProvider } from './provider.ts';

export function createCodexProvider(options: CodexBackendOptions = {}): ChatProvider {
    return {
        kind: 'codex',
        name: 'Codex',
        catalog: new ModelCatalog(codexManifest as never),
        capabilities: CODEX_CAPABILITIES,
        command: ['codex', ...CODEX_CHAT_ARGS],
        resumeCommand: CODEX_RESUME_COMMAND,
        // A folder's `.codex` layer loads once the person's own config trusts the folder or its repository, which a worktree inherits;
        // neither `-c` nor `project_root_markers` turns it off, and `--disable hooks` would take the person's hooks along (Codex 0.162.1).
        ignoresProjectConfig: false,
        // The auth variables Codex 0.157 names in its own "no Codex credentials were found" advice.
        home: { env: 'CODEX_HOME', fallback: '.codex', loginEnv: ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN'], loginCommand: 'codex login' },
        install: {
            description: "OpenAI's coding agent, in a terminal and in a chat.",
            commands: { darwin: 'npm install -g @openai/codex', linux: 'npm install -g @openai/codex', win32: 'npm install -g @openai/codex' },
            guideUrl: 'https://github.com/openai/codex',
            signIn: [
                { kind: 'command', command: 'codex login' },
                { kind: 'env', variable: 'OPENAI_API_KEY' }
            ]
        },
        detect: detectCli,
        // Read-only and without an approval to wait for: the run only has to read what it is handed. A chat's
        // title is asked in a folder that need not be a repository, and ephemeral keeps the run out of Codex's thread list.
        oneShotArgs: (prompt) => ['exec', '--color', 'never', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', prompt],
        // A prompt of `-` is read from stdin.
        oneShotStdinArgs: ['exec', '--color', 'never', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-'],
        // `codex [OPTIONS] [PROMPT]`: the positional starts the interactive session on that prompt.
        firstPromptArgs: (prompt) => [prompt],
        createBackend: (launch, host) => new CodexBackend(launch, host, options)
    };
}

export const codexProvider = createCodexProvider();
