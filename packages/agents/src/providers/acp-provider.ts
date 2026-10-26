import type { AgentKind, ProviderCapabilities, ProviderInstall } from '@adecore/agent-contracts';
import { createAcpBackend, type AcpAgentSpec, type AcpUsageReport } from '../chat/acp-backend.ts';
import type { AcpSessionInfo } from '../chat/acp-protocol.ts';
import { askAcpAccount } from './accounts/acp-account.ts';
import { AcpAgentState, type AcpCatalogStore } from './acp-agent-state.ts';
import { writeAcpUsage } from './acp-usage-log.ts';
import type { ModelCatalog } from './catalog.ts';
import { detectCli, type CliDetection } from './detect.ts';
import type { ChatProvider, ProviderHome } from './provider.ts';

/*
 * What every ACP agent can do through this backend, before what it shows of itself. A file change comes as the text
 * before and after; a message names its mentions and attachments by path, and carries the files themselves where the agent takes them.
 */
export const ACP_CAPABILITIES: ProviderCapabilities = {
    chat: true,
    terminal: false,
    hooks: false,
    streamsToolOutput: false,
    diffs: 'before-after',
    attachments: true,
    mentions: true,
    denyReason: false,
    allowAlways: true,
    asyncQuestions: false,
    compaction: 'none',
    reportsCost: false,
    reportsContextWindow: false,
    reportsThinking: true,
    slashCommands: true
};

/* One ACP agent as a host offers it: the backend's spec, plus what makes it a provider. */
export interface AcpProviderSpec extends AcpAgentSpec {
    kind: AgentKind;
    // The executable, and the arguments that start it as an ACP agent on its stdio.
    command: string;
    args?: readonly string[];
    catalog: ModelCatalog;
    // Over `ACP_CAPABILITIES` and what the agent showed it can do, for what the host knows better.
    capabilities?: Partial<ProviderCapabilities>;
    // What a terminal runs to continue one of its sessions; empty where it has none.
    resumeCommand?: string;
    home?: ProviderHome;
    install?: ProviderInstall;
    ignoresProjectConfig?: boolean;
    oneShotArgs?(prompt: string): string[];
    oneShotStdinArgs?: readonly string[];
    // Absent leaves the agent to chats only.
    firstPromptArgs?(prompt: string): string[];
    // Absent asks the executable for `--version`.
    detect?(command: string, env: Record<string, string | undefined>): Promise<CliDetection>;
    enabled?(): boolean;
    // Absent or true asks the agent over ACP whether an account is signed in; false leaves that to the host.
    accountProbe?: boolean;
    // Absent or true lets the models a session reports replace the catalog's; false keeps the catalog as the host built it.
    adoptModels?: boolean;
    // The folder the usage of every turn the agent reports is logged to, for a usage root of the agent's kind; absent logs nothing.
    usageLog?: string;
    // Keeps the models the agent reported across a restart of the host; absent starts from `catalog` every time.
    catalogStore?: AcpCatalogStore;
}

/* Agents whose own usage files the scanner reads; a log of their turns would count every one twice. */
const OWN_USAGE_FILES: ReadonlySet<AgentKind> = new Set(['grok']);

export function createAcpProvider(spec: AcpProviderSpec): ChatProvider {
    const state = new AcpAgentState({
        catalog: spec.catalog,
        adoptModels: spec.adoptModels !== false,
        store: spec.catalogStore ?? null,
        base: ACP_CAPABILITIES,
        overrides: spec.capabilities ?? {}
    });

    const onSession = (info: AcpSessionInfo): void => {
        state.session(info);
        spec.onSession?.(info);
    };

    const onCommands = (commands: string[]): void => {
        state.commandsListed(commands);
        spec.onCommands?.(commands);
    };

    const usageLog = spec.usageLog === undefined || OWN_USAGE_FILES.has(spec.kind) ? null : spec.usageLog;

    const onUsage =
        usageLog === null
            ? spec.onUsage
            : (report: AcpUsageReport): void => {
                  writeAcpUsage(usageLog, report, Date.now());
                  spec.onUsage?.(report);
              };

    return {
        kind: spec.kind,
        name: spec.name,
        catalog: spec.catalog,
        capabilities: state.capabilities,
        onChange: (listener) => state.onChange(listener),
        command: [spec.command, ...(spec.args ?? [])],
        resumeCommand: spec.resumeCommand ?? '',
        ...(spec.ignoresProjectConfig === undefined ? {} : { ignoresProjectConfig: spec.ignoresProjectConfig }),
        ...(spec.home ? { home: spec.home } : {}),
        ...(spec.install ? { install: spec.install } : {}),
        ...(spec.oneShotArgs ? { oneShotArgs: spec.oneShotArgs } : {}),
        ...(spec.oneShotStdinArgs ? { oneShotStdinArgs: spec.oneShotStdinArgs } : {}),
        ...(spec.enabled ? { enabled: spec.enabled } : {}),
        firstPromptArgs:
            spec.firstPromptArgs ??
            (() => {
                throw new Error(`${spec.name} is only available as a chat.`);
            }),
        detect: spec.detect ?? ((command, env) => detectCli(command, env)),
        ...(spec.accountProbe === false
            ? {}
            : {
                  askAccount: (command, env) =>
                      askAcpAccount({
                          name: spec.name,
                          command,
                          env: { ...env, ...spec.env },
                          ...(spec.client ? { client: spec.client } : {}),
                          onSession,
                          onCommands
                      })
              }),
        createBackend: createAcpBackend({
            ...spec,
            onSession,
            onCommands,
            onContextReport: () => {
                state.contextReported();
                spec.onContextReport?.();
            },
            ...(onUsage === undefined ? {} : { onUsage })
        })
    };
}
