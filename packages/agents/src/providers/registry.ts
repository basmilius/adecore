import type { AgentKind, ProviderCapabilities, ProviderInfo } from '@adecore/agent-contracts';
import { ModelCatalog } from './catalog.ts';
import { claudeProvider } from './claude-provider.ts';
import { codexProvider } from './codex-provider.ts';
import type { CliDetection } from './detect.ts';
import type { ChatProvider } from './provider.ts';

// How long a "is it installed" answer stays good; an install mid-session shows up on the next check.
const DETECTION_TTL_MS = 60_000;

const DISABLED: CliDetection = { installed: false, version: 'Disabled in Settings' };

const NO_CAPABILITIES: ProviderCapabilities = {
    chat: false,
    terminal: false,
    hooks: false,
    streamsToolOutput: false,
    diffs: 'none',
    attachments: false,
    mentions: false,
    denyReason: false,
    allowAlways: false,
    asyncQuestions: false,
    compaction: 'none',
    reportsCost: false,
    reportsContextWindow: false,
    reportsThinking: false,
    slashCommands: false
};

/* A CLI of a kind the host does not offer: a record or an account may still name one, and it starts nothing. */
export function unofferedProvider(kind: AgentKind): ChatProvider {
    return {
        kind,
        name: kind,
        catalog: new ModelCatalog({ defaultModel: '', profiles: {}, models: [] }),
        capabilities: NO_CAPABILITIES,
        command: [kind],
        resumeCommand: '',
        detect: () => Promise.resolve({ installed: false, version: null }),
        firstPromptArgs: () => {
            throw new Error(`${kind} is not offered here`);
        },
        createBackend: () => {
            throw new Error(`${kind} is not offered here`);
        }
    };
}

const BUILT_IN_PROVIDERS: readonly ChatProvider[] = [claudeProvider, codexProvider];

/* The provider of a kind, for the places that have no registry at hand. */
export function providerFor(kind: AgentKind): ChatProvider {
    return BUILT_IN_PROVIDERS.find((provider) => provider.kind === kind) ?? unofferedProvider(kind);
}

export interface ProviderRegistryOptions {
    // The CLIs a host offers, in the order every menu lists them; absent, the chat CLIs this package ships.
    providers?: ChatProvider[];
    // The executables to probe, when they are not the ones the providers name.
    commands?: Partial<Record<AgentKind, string>>;
    detect?: (command: string) => Promise<CliDetection>;
    env?: Record<string, string | undefined>;
}

/* What a host knows about each agent CLI: whether it is there, what it offers and what it can do. */
export class ProviderRegistry {
    private readonly providers: ChatProvider[];
    private readonly commands: Partial<Record<AgentKind, string>>;
    private readonly detect: ((command: string) => Promise<CliDetection>) | null;
    private readonly env: Record<string, string | undefined>;
    private readonly cache = new Map<AgentKind, { at: number; detection: CliDetection }>();
    private readonly listeners = new Set<(kind: AgentKind) => void>();
    // What the registry listens to on each provider, so one taken away is let go.
    private readonly stops = new Map<ChatProvider, () => void>();

    constructor(options: ProviderRegistryOptions = {}) {
        this.providers = [...(options.providers ?? BUILT_IN_PROVIDERS)];
        this.commands = options.commands ?? {};
        this.detect = options.detect ?? null;
        this.env = options.env ?? process.env;
    }

    /*
     * Offers one more provider after the host started, such as a CLI a person installed since, or puts it in the
     * place of the one of its kind. The `onChange` listeners hear its kind, so a host hands its clients the new list.
     */
    add(provider: ChatProvider): void {
        const index = this.providers.findIndex((entry) => entry.kind === provider.kind);

        if (index === -1) {
            this.providers.push(provider);
        } else {
            this.unfollow(this.providers[index]!);
            this.providers[index] = provider;
        }

        this.cache.delete(provider.kind);

        if (this.listeners.size > 0) {
            this.follow(provider);
        }

        this.changed(provider.kind);
    }

    /* Stops offering a kind; a record that names it gets the stand-in `get` answers for a kind the host does not offer. */
    remove(kind: AgentKind): void {
        const index = this.providers.findIndex((entry) => entry.kind === kind);

        if (index === -1) {
            return;
        }

        this.unfollow(this.providers[index]!);
        this.providers.splice(index, 1);
        this.cache.delete(kind);
        this.changed(kind);
    }

    async list(): Promise<ProviderInfo[]> {
        return await Promise.all(
            this.providers.map(async (provider) => ({
                kind: provider.kind,
                name: provider.name,
                ...(await this.detection(provider)),
                models: provider.catalog.list(),
                defaultModel: provider.catalog.defaultModel || null,
                capabilities: provider.capabilities,
                resumeCommand: provider.resumeCommand,
                ...(provider.install ? { install: provider.install } : {})
            }))
        );
    }

    /* The kinds this host offers, in the order every menu lists them. */
    kinds(): AgentKind[] {
        return this.providers.map((provider) => provider.kind);
    }

    /* The provider of a kind, one this host does not offer included. */
    get(kind: AgentKind): ChatProvider {
        return this.providers.find((provider) => provider.kind === kind) ?? this.fallback(kind);
    }

    /*
     * The CLI that answers a single prompt here: the one asked for when it is installed, else the
     * first installed provider that can, in the order the catalog lists them. Null on a machine
     * with none, which is what hides the button that would ask.
     */
    async oneShotProvider(preferred?: AgentKind): Promise<ChatProvider | null> {
        const order = preferred ? [this.get(preferred), ...this.providers] : this.providers;

        for (const provider of order) {
            if (provider.oneShotArgs && (await this.detection(provider)).installed) {
                return provider;
            }
        }

        return null;
    }

    catalogFor(kind: AgentKind): ModelCatalog {
        return this.get(kind).catalog;
    }

    enabled(kind: AgentKind): boolean {
        return this.get(kind).enabled?.() !== false;
    }

    /*
     * Calls the listener with the kind of every provider whose models or capabilities changed, and of every one
     * added or removed, so a host can list them again; answers how to stop.
     */
    onChange(listener: (kind: AgentKind) => void): () => void {
        if (this.listeners.size === 0) {
            for (const provider of this.providers) {
                this.follow(provider);
            }
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);

            if (this.listeners.size === 0) {
                for (const stop of this.stops.values()) {
                    stop();
                }

                this.stops.clear();
            }
        };
    }

    invalidate(kind: AgentKind): void {
        this.cache.delete(kind);
    }

    protected fallback(kind: AgentKind): ChatProvider {
        return unofferedProvider(kind);
    }

    private follow(provider: ChatProvider): void {
        if (provider.onChange && !this.stops.has(provider)) {
            this.stops.set(
                provider,
                provider.onChange(() => this.changed(provider.kind))
            );
        }
    }

    private unfollow(provider: ChatProvider): void {
        this.stops.get(provider)?.();
        this.stops.delete(provider);
    }

    private changed(kind: AgentKind): void {
        for (const listener of [...this.listeners]) {
            listener(kind);
        }
    }

    private async detection(provider: ChatProvider): Promise<CliDetection> {
        if (provider.enabled?.() === false) {
            return DISABLED;
        }

        const cached = this.cache.get(provider.kind);

        if (cached && Date.now() - cached.at < DETECTION_TTL_MS) {
            return cached.detection;
        }

        const command = this.commands[provider.kind] ?? provider.command[0]!;
        const detection = this.detect ? await this.detect(command) : await provider.detect(command, this.env);

        // Turned off while the probe ran.
        if (provider.enabled?.() === false) {
            return DISABLED;
        }

        this.cache.set(provider.kind, { at: Date.now(), detection });

        return detection;
    }
}
