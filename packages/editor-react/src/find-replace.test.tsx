import './test-setup.ts';
import { expect, test } from 'bun:test';
import { createInstance } from 'i18next';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { FakeEditorEngine } from '@adecore/editor/fake';
import { FindReplace } from './FindReplace.tsx';
import en from './locales/en.json';
import nl from './locales/nl.json';

for (const labels of [
    { language: 'en', input: 'Replace with', one: 'Replace', all: 'Replace all', preserve: 'Preserve case' },
    { language: 'nl', input: 'Vervangen door', one: 'Vervang', all: 'Alles vervangen', preserve: 'Hoofdletters behouden' }
]) {
    test(`find and replace renders usable ${labels.language} labels`, async () => {
        const i18n = createInstance();
        await i18n.init({
            lng: labels.language,
            initAsync: false,
            interpolation: { escapeValue: false },
            resources: { en: { editor: en }, nl: { editor: nl } }
        });
        const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: '', theme: 'light' });
        try {
            const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(FindReplace, { editor })));
            expect(markup).toContain(`aria-label="${labels.input}"`);
            expect(markup).toContain(`>${labels.one}<`);
            expect(markup).toContain(`>${labels.all}<`);
            expect(markup).toContain(labels.preserve);
        } finally {
            editor.dispose();
        }
    });
}
