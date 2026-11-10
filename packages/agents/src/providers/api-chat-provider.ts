import type { AgentKind } from '@adecore/agent-contracts';
import type { ModelCatalog } from './catalog.ts';
import type { ChatProvider, LaunchDecorator } from './provider.ts';

/** What the provider reads of the service that holds the key and the models. */
interface ApiChatService {
    readonly catalog: ModelCatalog;
    status(): { configured: boolean; models: number };
    onChange(listener: () => void): () => void;
}

interface ApiChatProviderOptions {
    readonly kind: AgentKind;
    readonly name: string;

    /** What a provider list draws beside the name once the provider is set up. */
    readonly version: string;

    readonly service: ApiChatService;
    readonly createBackend: ChatProvider['createBackend'];

    /** The host's additions to every launch, such as its MCP server. */
    readonly launch?: LaunchDecorator;
}

/**
 * A provider with no CLI: the host talks to the API itself, so the provider is there once a key is saved
 * and the API listed the models it offers. It runs only as a chat.
 */
export function createApiChatProvider({ kind, name, version, service, createBackend, launch }: ApiChatProviderOptions): ChatProvider {
    return {
        kind,
        name,
        ...(launch === undefined ? {} : { launch }),
        command: [kind],
        resumeCommand: '',
        catalog: service.catalog,
        ignoresProjectConfig: true,
        capabilities: {
            chat: true,
            terminal: false,
            hooks: false,
            streamsToolOutput: false,
            diffs: 'unified',
            attachments: false,
            mentions: false,
            denyReason: true,
            allowAlways: false,
            asyncQuestions: false,
            compaction: 'none',
            reportsCost: false,
            reportsContextWindow: true,
            reportsThinking: true,
            slashCommands: false
        },
        detect: async () => {
            const { configured, models } = service.status();
            const ready = configured && models > 0;

            return { installed: ready, version: ready ? version : null };
        },
        firstPromptArgs: () => {
            throw new Error(`${name} is only available as a chat.`);
        },
        onChange: (listener) => service.onChange(listener),
        createBackend
    };
}
