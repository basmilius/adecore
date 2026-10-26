import type { ModelCatalogData, ModelCatalogProfile, ModelInfo, ModelOptionDescriptor, ModelSelection } from '@adecore/agent-contracts';
import manifest from './claude-models.json' with { type: 'json' };

// What a host builds a catalog from; one that is never replaced needs no date.
export type ModelCatalogInput = Omit<ModelCatalogData, 'updatedAt'> & { updatedAt?: string };

const ADOPTED_PROFILE = 'agent';

function timeOf(data: ModelCatalogInput): number {
    return data.updatedAt === undefined ? 0 : Date.parse(data.updatedAt);
}

/*
 * The models a provider offers and what each one can be asked for. Bundled as JSON so a new
 * model is a data change; a profile is only needed for a new combination of options. A host may
 * swap in a newer copy while it runs, never one older than the copy it was built with.
 */
export class ModelCatalog {
    private readonly shippedAt: number;
    private data: ModelCatalogInput;
    // The sizes the host's own default had before an agent's models replaced it, for an adopted model that names none.
    private hostWindows: ModelCatalogProfile['contextWindowTokens'] | undefined;

    constructor(data: ModelCatalogInput = manifest as never) {
        this.shippedAt = timeOf(data);
        this.data = data;
    }

    get defaultModel(): string {
        return this.data.defaultModel;
    }

    /* Takes a validated copy unless it is older than the shipped one; answers whether the models changed. */
    replace(data: ModelCatalogData): boolean {
        if (timeOf(data) < this.shippedAt) {
            return false;
        }

        const changed = JSON.stringify(data) !== JSON.stringify(this.data);
        this.data = data;
        this.hostWindows = undefined;

        return changed;
    }

    /*
     * Takes the models an agent reported for itself in place of the list, the agent's current model as the
     * default and its order kept; answers whether the models changed. Every model gets the profile the
     * default has now, as an agent names its models but not what each can be asked for, with `options`
     * in place of the profile's options of the same id, and the context window in tokens a model names as its only size.
     */
    adopt(
        models: ReadonlyArray<{ slug: string; name: string; contextWindow?: number }>,
        defaultModel: string,
        options: readonly ModelOptionDescriptor[] = []
    ): boolean {
        if (models.length === 0 || !models.some((model) => model.slug === defaultModel)) {
            return false;
        }

        const base = this.profileOf(this.data.defaultModel) ?? { options: [], contextWindowTokens: {} };
        const replaced = new Set(options.map((option) => option.id));
        this.hostWindows ??= base.contextWindowTokens;
        const profile = { ...base, contextWindowTokens: this.hostWindows, options: [...base.options.filter((option) => !replaced.has(option.id)), ...options] };

        const profileName = (window: number | undefined): string => (window === undefined ? ADOPTED_PROFILE : `${ADOPTED_PROFILE}-${window}`);

        const profiles: Record<string, ModelCatalogProfile> = {};

        for (const model of models) {
            profiles[profileName(model.contextWindow)] =
                model.contextWindow === undefined ? profile : { ...profile, contextWindowTokens: { '*': model.contextWindow } };
        }

        const data: ModelCatalogInput = {
            ...(this.data.updatedAt === undefined ? {} : { updatedAt: this.data.updatedAt }),
            defaultModel,
            profiles,
            models: models.map((model) => ({ slug: model.slug, name: model.name, profile: profileName(model.contextWindow) }))
        };

        const changed = JSON.stringify(data) !== JSON.stringify(this.data);
        this.data = data;

        return changed;
    }

    list(): ModelInfo[] {
        return this.data.models.map((model) => ({
            slug: model.slug,
            name: model.name,
            badge: model.badge,
            ...(model.vendor === undefined ? {} : { vendor: model.vendor }),
            legacy: model.legacy === true,
            isDefault: model.slug === this.data.defaultModel,
            options: this.profileOf(model.slug)?.options ?? [],
            ...(model.minCliVersion === undefined ? {} : { minCliVersion: model.minCliVersion }),
            ...(model.tools === undefined ? {} : { tools: model.tools })
        }));
    }

    /* What a person reads for a model, so an error in a thread names it the way the picker does. */
    nameOf(slug: string): string {
        return this.data.models.find((entry) => entry.slug === slug)?.name ?? slug;
    }

    /* Accepts a slug or an alias; unknown models answer null so the caller can decide what to do. */
    resolveModel(name: string): string | null {
        const model = this.data.models.find((entry) => entry.slug === name || entry.aliases?.includes(name));

        return model?.slug ?? null;
    }

    /* Fills in defaults and drops options the model does not have, so a selection is always complete. */
    normalize(selection: Partial<ModelSelection> | undefined): ModelSelection {
        const model = (selection?.model && this.resolveModel(selection.model)) || this.defaultModel;
        const options: ModelSelection['options'] = {};

        for (const descriptor of this.profileOf(model)?.options ?? []) {
            const given = selection?.options?.[descriptor.id];

            if (descriptor.type === 'select') {
                options[descriptor.id] =
                    typeof given === 'string' && descriptor.choices.some((choice) => choice.id === given) ? given : descriptor.defaultChoice;
            } else {
                options[descriptor.id] = typeof given === 'boolean' ? given : descriptor.defaultValue;
            }
        }

        return { model, options };
    }

    contextWindowFor(selection: ModelSelection): number | null {
        const profile = this.profileOf(selection.model);

        if (!profile) {
            return null;
        }

        const chosen = selection.options.contextWindow;

        return (typeof chosen === 'string' ? profile.contextWindowTokens[chosen] : undefined) ?? profile.contextWindowTokens['*'] ?? null;
    }

    private profileOf(slug: string): ModelCatalogProfile | undefined {
        const model = this.data.models.find((entry) => entry.slug === slug);

        return model ? this.data.profiles[model.profile] : undefined;
    }
}
