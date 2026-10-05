import type { i18n as I18n } from 'i18next';
import en from './locales/en.json' with { type: 'json' };
import nl from './locales/nl.json' with { type: 'json' };

/* The words of this package live in a namespace of their own, beside the `ui` namespace and the app's. */
export const DATABASE_NAMESPACE = 'database';

/* Every language the package speaks, by language code. */
export const DATABASE_RESOURCES: Readonly<Record<string, Record<string, unknown>>> = { en, nl };

/* Adds the `database` namespace in every language to an i18next instance. A language the app already filled keeps its words. */
export const addDatabaseResources = (i18n: I18n): void => {
    for (const [language, words] of Object.entries(DATABASE_RESOURCES)) {
        if (!i18n.hasResourceBundle(language, DATABASE_NAMESPACE)) {
            i18n.addResourceBundle(language, DATABASE_NAMESPACE, words, true, false);
        }
    }
};
