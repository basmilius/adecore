import { ModelOptionDescriptorSchema, type ModelOptionDescriptor, type ProviderCapabilities } from '@adecore/agent-contracts';
import { z } from 'zod';
import type { AcpSessionInfo } from '../chat/acp-protocol.ts';
import type { ModelCatalog } from './catalog.ts';

/* Where a provider keeps what its agent reported, so a host that starts again offers it before the agent runs. The value is the provider's own. */
export interface AcpCatalogStore {
    load(): unknown;
    save(value: unknown): void;
}

const AdoptedSchema = z.object({
    defaultModel: z.string().min(1),
    models: z.array(z.object({ slug: z.string().min(1), name: z.string(), contextWindow: z.number().int().positive().optional() })).min(1),
    options: z.array(ModelOptionDescriptorSchema)
});

type Adopted = z.infer<typeof AdoptedSchema>;

/* An agent's model id may reach a command line, so one that reads as a flag is left out. */
function adoptableModels(info: AcpSessionInfo): Adopted['models'] {
    return (info.models?.models ?? [])
        .filter((model) => model.id !== '' && !model.id.startsWith('-'))
        .map((model) => ({ slug: model.id, name: model.name, ...(model.contextWindow === null ? {} : { contextWindow: model.contextWindow }) }));
}

/*
 * An agent may name its choices in lowercase, as Copilot CLI 1.0.101 names its efforts; a person reads them with a
 * capital like every other label. Also applied to what a store kept from before, so only the labels change, never the ids.
 */
function capitalized(option: ModelOptionDescriptor): ModelOptionDescriptor {
    if (option.type !== 'select') {
        return option;
    }

    return {
        ...option,
        choices: option.choices.map((choice) => ({ ...choice, label: choice.label.charAt(0).toLocaleUpperCase('en') + choice.label.slice(1) }))
    };
}

/* The reasoning effort a session offers, as the `effort` option the composer draws for every provider. */
function effortOption(info: AcpSessionInfo): ModelOptionDescriptor[] {
    const level = info.thoughtLevel;

    if (level === null || !level.choices.some((choice) => choice.id === level.current)) {
        return [];
    }

    return [
        {
            id: 'effort',
            label: 'Reasoning',
            type: 'select',
            defaultChoice: level.current,
            choices: level.choices.map((choice) => ({
                id: choice.id,
                label: choice.name,
                ...(choice.description === null ? {} : { description: choice.description })
            }))
        }
    ];
}

/* Parses one stored part on its own, so a part a later version wrote differently costs only that part. */
function storedPart<T>(schema: z.ZodType<T>, value: unknown): T | null {
    const parsed = schema.safeParse(value);

    return parsed.success ? parsed.data : null;
}

export interface AcpAgentStateOptions {
    catalog: ModelCatalog;
    adoptModels: boolean;
    store: AcpCatalogStore | null;
    // The capabilities the provider reports before what the agent said is laid over them.
    base: ProviderCapabilities;
    // What the host set itself, which wins over what the agent said.
    overrides: Partial<ProviderCapabilities>;
}

/*
 * What an agent reported about itself, outside any one session: the models it offers and what follows from it for the
 * provider's capabilities. Kept in the host's store when it has one, and every change is told to the listeners, so a host
 * can hand its clients the new list.
 */
export class AcpAgentState {
    // Changed in place, so a host that spread the provider into a value of its own reads the same object.
    readonly capabilities: ProviderCapabilities;
    private readonly options: AcpAgentStateOptions;
    private readonly listeners = new Set<() => void>();
    private adopted: Adopted | null = null;
    // Whether the agent reported its context window in a `usage_update`, once in any session.
    private reportsContext = false;
    // The slash commands the last session listed; null until one did.
    private commands: string[] | null = null;

    constructor(options: AcpAgentStateOptions) {
        this.options = options;
        this.capabilities = { ...options.base, ...options.overrides };
        this.restore();
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    session(info: AcpSessionInfo): void {
        if (!this.options.adoptModels || info.models === null) {
            return;
        }

        this.settle(this.adopt({ defaultModel: info.models.current, models: adoptableModels(info), options: effortOption(info) }));
    }

    commandsListed(commands: readonly string[]): void {
        const names = [...new Set(commands)].sort();

        if (this.commands !== null && JSON.stringify(names) === JSON.stringify(this.commands)) {
            return;
        }

        this.commands = names;
        const changed = this.refresh();
        // The commands are saved even when the capabilities stay, so a restart knows them too.
        this.save();

        if (changed) {
            this.notify();
        }
    }

    contextReported(): void {
        if (this.reportsContext) {
            return;
        }

        this.reportsContext = true;
        this.settle(this.refresh());
    }

    private restore(): void {
        let stored: unknown;

        try {
            stored = this.options.store?.load();
        } catch {
            return;
        }

        if (typeof stored !== 'object' || stored === null) {
            return;
        }

        const record = stored as Record<string, unknown>;
        const adopted = storedPart(AdoptedSchema, record.models);

        if (adopted !== null && this.options.adoptModels) {
            this.adopt(adopted);
        }

        this.reportsContext = record.reportsContext === true;
        this.commands = storedPart(z.array(z.string()), record.commands);
        this.refresh();
    }

    /* What the agent showed it can do, under what the host set itself. */
    private learned(): Partial<ProviderCapabilities> {
        const commands = this.commands ?? [];

        return {
            ...(this.reportsContext ? { reportsContextWindow: true } : {}),
            ...(commands.includes('compact') ? { compaction: 'prompt' as const } : {}),
            ...(commands.includes('goal') ? { goals: 'command' as const } : {})
        };
    }

    /* Lays what the agent showed over the capabilities, in place; answers whether they changed. */
    private refresh(): boolean {
        const next: ProviderCapabilities = { ...this.options.base, ...this.learned(), ...this.options.overrides };

        if (JSON.stringify(next) === JSON.stringify(this.capabilities)) {
            return false;
        }

        const capabilities = this.capabilities as Partial<ProviderCapabilities>;

        for (const key of Object.keys(capabilities) as Array<keyof ProviderCapabilities>) {
            delete capabilities[key];
        }

        Object.assign(capabilities, next);

        return true;
    }

    /* Answers whether the catalog changed; a list without its default is refused there and leaves the one adopted before. */
    private adopt(adopted: Adopted): boolean {
        if (!adopted.models.some((model) => model.slug === adopted.defaultModel)) {
            return false;
        }

        this.adopted = adopted;

        return this.options.catalog.adopt(adopted.models, adopted.defaultModel, adopted.options.map(capitalized));
    }

    /* Saves and tells the listeners once something changed. */
    private settle(changed: boolean): void {
        if (changed) {
            this.save();
            this.notify();
        }
    }

    private save(): void {
        try {
            this.options.store?.save(this.stored());
        } catch {
            // A store that cannot write costs the next start what it would have kept, never this session.
        }
    }

    private notify(): void {
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    private stored(): Record<string, unknown> {
        return {
            ...(this.adopted === null ? {} : { models: this.adopted }),
            ...(this.reportsContext ? { reportsContext: true } : {}),
            ...(this.commands === null ? {} : { commands: this.commands })
        };
    }
}
