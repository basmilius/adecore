import { create, type StateCreator, type StoreApi, type UseBoundStore } from 'zustand';

export type ChatStorageRecord = 'drafts' | 'preferences' | 'stash' | 'usage';

export interface ChatStorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface ChatStorageOptions {
    namespace?: string;
    keys?: Partial<Record<ChatStorageRecord, string>>;
    legacyNamespaces?: readonly string[];
    legacyKeys?: Partial<Record<ChatStorageRecord, readonly string[]>>;
    /* Null keeps values in memory; an omitted adapter uses browser storage on first use. */
    storage?: ChatStorageAdapter | null;
}

const SUFFIXES: Record<ChatStorageRecord, string> = {
    drafts: 'chat.drafts',
    preferences: 'chat.preferences',
    stash: 'chat.stash',
    usage: 'usage'
};

let options: ChatStorageOptions = {};
let hydrated = false;
const hydrators: Array<() => void> = [];
const configurationListeners: Array<() => void> = [];

export function onChatStorageConfiguration(listener: () => void): void {
    configurationListeners.push(listener);
}

/* Configure once before using a store, so an imported component cannot read another host's records. */
export function configureChatStorage(configuration: ChatStorageOptions): void {
    if (hydrated) {
        throw new Error('Configure chat storage before using chat stores');
    }
    options = {
        ...configuration,
        keys: { ...configuration.keys },
        legacyNamespaces: [...(configuration.legacyNamespaces ?? [])],
        legacyKeys: Object.fromEntries(Object.entries(configuration.legacyKeys ?? {}).map(([key, values]) => [key, [...values]]))
    };
    for (const listener of configurationListeners) {
        listener();
    }
}

export function chatStorageKey(record: ChatStorageRecord): string {
    return options.keys?.[record] ?? `${options.namespace ?? 'adecore'}.${SUFFIXES[record]}`;
}

export function chatStorageLegacyKeys(record: ChatStorageRecord): readonly string[] {
    return [...(options.legacyKeys?.[record] ?? []), ...(options.legacyNamespaces ?? []).map((namespace) => `${namespace}.${SUFFIXES[record]}`)];
}

export function chatStorageAdapter(): ChatStorageAdapter | null {
    if (options.storage !== undefined) {
        return options.storage;
    }
    try {
        return globalThis.localStorage;
    } catch {
        return null;
    }
}

export function hydrateChatStorage(): void {
    if (hydrated) {
        return;
    }
    hydrated = true;
    for (const hydrate of hydrators) {
        hydrate();
    }
}

export function createChatStore<T>(initial: StateCreator<T>, hydrate: (store: StoreApi<T>) => void): UseBoundStore<StoreApi<T>> {
    const store = create<T>(initial);
    let initialized = false;
    const hydrateOnce = (): void => {
        if (initialized) {
            return;
        }
        initialized = true;
        hydrate(store);
    };
    hydrators.push(hydrateOnce);
    const ready = (): void => {
        hydrateChatStorage();
        hydrateOnce();
    };
    const useStore = ((...args: Parameters<typeof store>) => {
        ready();
        return store(...args);
    }) as typeof store;
    Object.assign(useStore, store);
    useStore.getState = () => {
        ready();
        return store.getState();
    };
    useStore.subscribe = (...args) => {
        ready();
        return store.subscribe(...args);
    };
    useStore.setState = ((...args: Parameters<typeof store.setState>) => {
        ready();
        store.setState(...args);
    }) as typeof store.setState;
    return useStore;
}
