import type { ModelCatalogData, ModelCatalogProfile, ModelInfo, ModelOptionDescriptor, ModelSelection } from '@adecore/agent-contracts';
import manifest from './claude-models.json' with { type: 'json' };

// What a host builds a catalog from; one that is never replaced needs no date.
export type ModelCatalogInput = Omit<ModelCatalogData, 'updatedAt'> & { updatedAt?: string };

const ADOPTED_PROFILE = 'agent';

type AdoptedModel = { slug: string; name: string; contextWindow?: number };

interface Adopted {
    readonly models: readonly AdoptedModel[];
    readonly defaultModel: string;
    readonly options: readonly ModelOptionDescriptor[];
}

function timeOf(data: ModelCatalogInput): number {
    return data.updatedAt === undefined ? 0 : Date.parse(data.updatedAt);
}

function profileIn(data: ModelCatalogInput, slug: string): ModelCatalogProfile | undefined {
    const model = data.models.find((entry) => entry.slug === slug);

    return model ? data.profiles[model.profile] : undefined;
}

/*
 * The agent's models in the agent's order, with the agent's default. A model the base knows keeps how the base names
 * it and its profile; every other one gets the profile of the base's default, with the context window it reported as
 * its only size. The options an agent reports replace the profile's options of the same id either way.
 */
function compose(base: ModelCatalogInput, adopted: Adopted): ModelCatalogInput {
    const replaced = new Set(adopted.options.map((option) => option.id));

    const withOptions = (profile: ModelCatalogProfile): ModelCatalogProfile => ({
        ...profile,
        options: [...profile.options.filter((option) => !replaced.has(option.id)), ...adopted.options]
    });

    const fallback = profileIn(base, base.defaultModel) ?? { options: [], contextWindowTokens: {} };
    const profiles: Record<string, ModelCatalogProfile> = {};

    const models = adopted.models.map((model) => {
        const known = base.models.find((entry) => entry.slug === model.slug);
        const knownProfile = known === undefined ? undefined : base.profiles[known.profile];

        if (known !== undefined && knownProfile !== undefined) {
            const name = `${ADOPTED_PROFILE}:${known.profile}`;
            profiles[name] = withOptions(knownProfile);

            return { ...known, profile: name };
        }

        const name = model.contextWindow === undefined ? ADOPTED_PROFILE : `${ADOPTED_PROFILE}-${model.contextWindow}`;
        profiles[name] = withOptions(model.contextWindow === undefined ? fallback : { ...fallback, contextWindowTokens: { '*': model.contextWindow } });

        return { slug: model.slug, name: model.name, profile: name };
    });

    return {
        ...(base.updatedAt === undefined ? {} : { updatedAt: base.updatedAt }),
        defaultModel: adopted.defaultModel,
        profiles,
        models
    };
}

/*
 * The models a provider offers and what each one can be asked for. Bundled as JSON so a new
 * model is a data change; a profile is only needed for a new combination of options. A host may
 * swap in a newer copy while it runs, never one older than the copy it was built with. What an
 * agent reported for itself lies over that copy and survives a newer one.
 */
export class ModelCatalog {
    private readonly shippedAt: number;
    private base: ModelCatalogInput;
    private adopted: Adopted | null = null;
    private data: ModelCatalogInput;

    constructor(data: ModelCatalogInput = manifest as never) {
        this.shippedAt = timeOf(data);
        this.base = data;
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

        this.base = data;

        return this.settle();
    }

    /*
     * Takes the models an agent reported for itself in place of the list, the agent's current model as the
     * default and its order kept; answers whether the models changed. An agent names its models but not what
     * each can be asked for, so that comes from the base where it knows the model (see `compose`).
     */
    adopt(models: readonly AdoptedModel[], defaultModel: string, options: readonly ModelOptionDescriptor[] = []): boolean {
        if (models.length === 0 || !models.some((model) => model.slug === defaultModel)) {
            return false;
        }

        this.adopted = { models: [...models], defaultModel, options: [...options] };

        return this.settle();
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
        return profileIn(this.data, slug);
    }

    private settle(): boolean {
        const data = this.adopted === null ? this.base : compose(this.base, this.adopted);
        const changed = JSON.stringify(data) !== JSON.stringify(this.data);
        this.data = data;

        return changed;
    }
}
