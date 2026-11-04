import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from '@adecore/charts';
import i18next from 'i18next';

/* The app's own i18next. `UIProvider` adds the library's `ui` namespace to it, in English and in Dutch; the charts namespace the app adds itself. */
export const i18n = i18next.createInstance();

void i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: Object.fromEntries(Object.entries(CHARTS_RESOURCES).map(([language, words]) => [language, { [CHARTS_NAMESPACE]: words }])),
    interpolation: { escapeValue: false },
    initAsync: false
});
