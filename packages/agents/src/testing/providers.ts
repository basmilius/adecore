import type { AgentKind } from '@adecore/agent-contracts';
import { DEFAULT_CODEX_CLIENT } from '../backends/codex-transport.ts';
import { createClaudeProvider } from '../providers/claude-provider.ts';
import { createCodexProvider } from '../providers/codex-provider.ts';
import type { ChatProvider } from '../providers/provider.ts';
import { unofferedProvider } from '../providers/registry.ts';

/* Claude Code and Codex as a test wants them: the plain providers, on the default client identity. */
export const claudeProvider: ChatProvider = createClaudeProvider();
export const codexProvider: ChatProvider = createCodexProvider({ client: DEFAULT_CODEX_CLIENT });

/* The provider of a kind a test names, or the stand-in for a kind nobody offers. */
export function providerFor(kind: AgentKind): ChatProvider {
    return [claudeProvider, codexProvider].find((provider) => provider.kind === kind) ?? unofferedProvider(kind);
}
