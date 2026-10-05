import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { UI_NAMESPACE, UI_RESOURCES } from '@adecore/ui';
import { AGENTS_LOCALES } from '../src/locales';

// Label tests need the same synchronous English resources as rendered controls.
await i18next.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: UI_NAMESPACE,
    initAsync: false,
    interpolation: { escapeValue: false },
    resources: { en: { [UI_NAMESPACE]: UI_RESOURCES.en, ...(await AGENTS_LOCALES.en!()) } }
});
