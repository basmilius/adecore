import type { FormatSource } from '@basmilius/react-ui/format';
import { i18n } from './i18n.ts';

interface Preferences {
    language: string;
    region: string;
}

const listeners = new Set<() => void>();

let current: Preferences = { language: 'en', region: 'language' };

/* What a person set, the way an app keeps it: a language for the words and a region for the notation. */
export const preferences = {
    get: (): Preferences => current,
    set(next: Partial<Preferences>): void {
        current = { ...current, ...next };
        void i18n.changeLanguage(current.language);
        for (const listener of listeners) {
            listener();
        }
    },
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
};

/* The formatters read both settings through this and draw again when either changes. */
export const formatSource: FormatSource = {
    language: () => current.language,
    region: () => current.region,
    subscribe: preferences.subscribe
};
