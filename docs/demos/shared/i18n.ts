import i18next from 'i18next';

/* The app's own i18next. `UIProvider` adds the library's `ui` namespace to it, in English and in Dutch. */
export const i18n = i18next.createInstance();

void i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {},
    interpolation: { escapeValue: false },
    initAsync: false
});
