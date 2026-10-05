import { chatStorageAdapter, hydrateChatStorage } from '../storage';

export interface PersistedJson<T> {
    read(): T;
    /* False when storage refused; the value still survives for this session. */
    write(value: T): boolean;
}

export function persistedJson<T>(
    key: string | (() => string),
    parse: (raw: string | null) => T,
    fallback: T,
    legacyKeys: () => readonly string[] = () => []
): PersistedJson<T> {
    let memory = fallback;
    let unwritten = false;
    const currentKey = (): string => (typeof key === 'string' ? key : key());
    return {
        read: () => {
            hydrateChatStorage();
            if (unwritten) {
                return memory;
            }
            try {
                const storage = chatStorageAdapter();
                if (!storage) {
                    return memory;
                }
                let raw = storage.getItem(currentKey());
                if (raw === null) {
                    for (const legacy of legacyKeys()) {
                        raw = storage.getItem(legacy);
                        if (raw !== null) {
                            // Keep the old key for clients still using it, and migrate without changing the record.
                            try {
                                storage.setItem(currentKey(), raw);
                            } catch {
                                // A full storage still lets the existing record be read.
                            }
                            break;
                        }
                    }
                }
                memory = parse(raw);
                return memory;
            } catch {
                return memory;
            }
        },
        write: (value) => {
            hydrateChatStorage();
            memory = value;
            unwritten = true;
            try {
                const storage = chatStorageAdapter();
                if (!storage) {
                    return false;
                }
                storage.setItem(currentKey(), JSON.stringify(value));
                unwritten = false;
                return true;
            } catch {
                return false;
            }
        }
    };
}
