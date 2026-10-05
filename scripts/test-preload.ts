import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ui from '../packages/ui/src/locales/en.json';

const resources: Record<string, object> = { ui };
const locales = new URL('../packages/agents-react/src/locales/en/', import.meta.url).pathname;
if (existsSync(locales)) {
    for (const file of readdirSync(locales).filter((name) => name.endsWith('.json'))) {
        resources[file.slice(0, -5)] = JSON.parse(readFileSync(join(locales, file), 'utf8')) as object;
    }
}

// Pure label helpers share the same initialized English instance as React render tests.
await i18next.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'ui',
    initAsync: false,
    interpolation: { escapeValue: false },
    resources: { en: resources }
});
