import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import editor from './locales/en.json';

if (!i18next.isInitialized) {
    await i18next
        .use(initReactI18next)
        .init({ lng: 'en', fallbackLng: 'en', initAsync: false, interpolation: { escapeValue: false }, resources: { en: { editor } } });
} else {
    i18next.addResourceBundle('en', 'editor', editor, true, true);
}
