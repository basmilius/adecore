// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
export { type AcpCatalogStore } from './acp-agent-state.ts';
export { type ApiChatService, type ApiChatProviderOptions, createApiChatProvider } from './api-chat-provider.ts';
export { ACP_CAPABILITIES, type AcpProviderSpec, createAcpProvider } from './acp-provider.ts';
export {
    type AcpVendorOptions,
    type AcpServerLaunch,
    type CopilotProviderOptions,
    type AntigravityProviderOptions,
    type GrokModels,
    AGENT_DEFAULT_MODEL,
    agentDefaultCatalog,
    shippedAgentCatalog,
    agentModel,
    GROK_MODES,
    COPILOT_MODES,
    ANTIGRAVITY_MODES,
    ANTIGRAVITY_CLI,
    grokAuthMethod,
    readGrokModels,
    askGrokModels,
    adoptGrokModels,
    copilotUsageDirectory,
    antigravityOneShotArgs,
    createGrokProvider,
    createCopilotProvider,
    createAntigravityProvider
} from './acp-vendors.ts';
export { type AcpAccountProbe, askAcpAccount, type ProbeTimer } from './accounts/acp-account.ts';
export { chooseAccount, type AccountChoiceInput, type AccountUnusable, type ChosenAccount } from './accounts/choose.ts';
export { AccountError, type AccountLaunches, storedAccount, launchEnv } from './accounts/launch.ts';
export { ProviderAccountsService, type ProviderAccountsOptions } from './accounts/service.ts';
export type { OwnsSettings } from './accounts/shared-config.ts';
export type { ShadowHomeReport } from './accounts/shadow-home.ts';
export type { AccountReading } from './accounts/status.ts';
export { type AccountsHost, variablesProblem, keychainService, type SecretStore, type ReservedVariables } from './accounts/variables.ts';
export { ModelCatalog, type ModelCatalogInput } from './catalog.ts';
export { type CliMcpServer, cliMcpHeaders } from '../backends/cli-mcp.ts';
export { createClaudeProvider, type ClaudeProviderOptions } from './claude-provider.ts';
export { createCodexProvider, type CodexProviderOptions } from './codex-provider.ts';
export { type CodexRules, codexRulesText, codexRulesPathIn, defaultCodexHome, installCodexRules, type CodexRulesResult } from './codex-rules.ts';
export { codexThreadOptions, codexServiceTier } from '../backends/codex.ts';
export { type CliDetection, detectCli } from './detect.ts';
export {
    type ChatProvider,
    type ClaudeCodeRuntime,
    type LaunchDecorator,
    type ProviderHome,
    type ProviderShare,
    type ProviderTerminal,
    type SubagentSource,
    cliExecutable
} from './provider.ts';
export { nanoGptVendorOf } from './nanogpt-vendor.ts';
export { isOnlyCommands } from './shell-commands.ts';
export { ProviderRegistry, type ProviderRegistryOptions } from './registry.ts';
export { MODE_ORDER, narrowerMode, ceilingForOpening, modeField } from '../modes.ts';
