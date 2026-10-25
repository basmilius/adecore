import { FRONTIER_PROVIDER_KINDS, groupProvidersByFrontier, type AgentKind, type ModelInfo, type ProviderInfo } from '@adecore/agent-contracts';
import { nameCollator } from '@adecore/ui/format';

/* The providers in the order a picker lists them: the frontier labs first, then the rest, each by name. */
export function inPickerOrder<T extends { kind: AgentKind; name: string }>(providers: readonly T[]): T[] {
    const groups = groupProvidersByFrontier(providers);
    return [...groups.frontier, ...groups.others];
}

/* Whether a separator goes between two providers next to each other in that order: where the frontier labs end. */
export function separatesFrontier(previous: AgentKind | undefined, kind: AgentKind): boolean {
    return previous !== undefined && FRONTIER_PROVIDER_KINDS.has(previous) && !FRONTIER_PROVIDER_KINDS.has(kind);
}

/*
 * A provider with more live models than this keeps the list short: the model that is picked and the default,
 * with the rest behind one row that opens all of them. A list of three hundred models is not one to scroll.
 */
export const COMPACT_MODEL_LIMIT = 8;

/* A model row, or a row that folds more models open: one provider's models, or the legacy ones. All of them take a turn in the arrow keys. */
export type PickerEntry =
    | { kind: 'model'; provider: ProviderInfo; model: ModelInfo }
    | { kind: 'legacy'; count: number }
    | { kind: 'all'; provider: ProviderInfo; count: number; open: boolean };

export interface PickerCurrent {
    provider: AgentKind;
    model: string;
}

/* The models a person starred, per CLI. */
export type FavoritesOf = (kind: AgentKind) => ReadonlySet<string>;

const NO_FAVORITES: FavoritesOf = () => new Set();
const VENDOR_ORDER: Intl.CollatorOptions = { sensitivity: 'base' };
const MODEL_ORDER: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };

function matches(model: ModelInfo, query: string): boolean {
    return model.name.toLowerCase().includes(query) || model.slug.toLowerCase().includes(query) || (model.vendor?.toLowerCase().includes(query) ?? false);
}

/*
 * By maker, then by name, when the provider says who made its models; a list with no makers keeps the order
 * it came in. A model with no maker goes last, so the ones that have one read as groups.
 */
export function modelsByVendor(models: ModelInfo[]): ModelInfo[] {
    if (!models.some((model) => model.vendor !== undefined)) {
        return models;
    }
    const vendorOrder = nameCollator(VENDOR_ORDER).compare;
    const modelOrder = nameCollator(MODEL_ORDER).compare;
    return [...models].sort((a, b) => {
        if (a.vendor === undefined || b.vendor === undefined) {
            return a.vendor === b.vendor ? 0 : a.vendor === undefined ? 1 : -1;
        }
        return vendorOrder(a.vendor, b.vendor) || modelOrder(a.name, b.name);
    });
}

/* The starred models first, in the order they came, then the rest by maker. */
export function favoritesFirst(models: ModelInfo[], favorites: ReadonlySet<string>): ModelInfo[] {
    if (favorites.size === 0) {
        return modelsByVendor(models);
    }
    return [...models.filter((model) => favorites.has(model.slug)), ...modelsByVendor(models.filter((model) => !favorites.has(model.slug)))];
}

/*
 * The models a long list shows before it is opened: the starred ones, the default and the one that is picked.
 * Null when the list is short enough to show whole.
 */
export function shortlistOf(
    kind: AgentKind,
    models: ModelInfo[],
    current: PickerCurrent | null,
    favorites: ReadonlySet<string> = new Set()
): ModelInfo[] | null {
    if (models.length <= COMPACT_MODEL_LIMIT) {
        return null;
    }
    return favoritesFirst(
        models.filter((model) => model.isDefault || favorites.has(model.slug) || (current?.provider === kind && current.model === model.slug)),
        favorites
    );
}

/* Whether the providers offer enough models together that a search is quicker than reading the list. */
export function wantsModelSearch(providers: readonly ProviderInfo[]): boolean {
    return providers.reduce((count, entry) => count + entry.models.length, 0) > COMPACT_MODEL_LIMIT;
}

/* Every model of every provider that a search finds, legacy ones included, starred first and then by maker; a provider with none is left out. */
export function searchModels(
    providers: readonly ProviderInfo[],
    query: string,
    favoritesOf: FavoritesOf = NO_FAVORITES
): Array<{ entry: ProviderInfo; models: ModelInfo[] }> {
    const needle = query.trim().toLowerCase();
    return providers
        .map((entry) => ({
            entry,
            models: favoritesFirst(
                entry.models.filter((model) => matches(model, needle)),
                favoritesOf(entry.kind)
            )
        }))
        .filter((group) => group.models.length > 0);
}

const NONE: ReadonlySet<AgentKind> = new Set();

/*
 * The rows of the model list. A model an old CLI cannot run is a row like any other, so a search for
 * only that model still finds the row that explains why it cannot be picked. A search looks through
 * every model of every provider; without one, a provider with many models shows a short list and a row
 * that opens the rest, grouped by maker. A provider's starred models come first wherever it lists them.
 */
export function pickerEntriesOf(
    providers: readonly ProviderInfo[],
    query: string,
    legacyOpen: boolean,
    expanded: ReadonlySet<AgentKind> = NONE,
    current: PickerCurrent | null = null,
    favoritesOf: FavoritesOf = NO_FAVORITES
): PickerEntry[] {
    const rowsOf = (entry: ProviderInfo, models: ModelInfo[]): PickerEntry[] =>
        favoritesFirst(models, favoritesOf(entry.kind)).map((model) => ({ kind: 'model', provider: entry, model }));
    if (query !== '') {
        return providers.flatMap((entry) =>
            rowsOf(
                entry,
                entry.models.filter((model) => matches(model, query))
            )
        );
    }
    const legacy = providers.flatMap((entry) =>
        entry.models.filter((model) => model.legacy).map((model) => ({ kind: 'model' as const, provider: entry, model }))
    );
    const live = providers.flatMap((entry): PickerEntry[] => {
        const models = entry.models.filter((model) => !model.legacy);
        const shortlist = shortlistOf(entry.kind, models, current, favoritesOf(entry.kind));
        if (shortlist === null) {
            return rowsOf(entry, models);
        }
        if (expanded.has(entry.kind)) {
            return [{ kind: 'all', provider: entry, count: models.length, open: true }, ...rowsOf(entry, models)];
        }
        return [...rowsOf(entry, shortlist), { kind: 'all', provider: entry, count: models.length, open: false }];
    });
    if (legacy.length === 0) {
        return live;
    }
    return legacyOpen ? [...live, { kind: 'legacy', count: legacy.length }, ...legacy] : [...live, { kind: 'legacy', count: legacy.length }];
}
