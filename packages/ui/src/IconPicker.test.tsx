import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { Bug, Cloud, GitBranch, Rocket, Server } from 'lucide-react';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setFormatSource, type FormatSource } from './format/locale.ts';
import { IconPicker, type IconPickerGroup } from './IconPicker.tsx';
import { fakeFormatSource } from './testing/fake-source.ts';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const GROUPS: IconPickerGroup[] = [
    { id: 'code', label: 'Code', icons: { 'git-branch': GitBranch, bug: Bug } },
    { id: 'infra', label: 'Infrastructure', icons: { server: Server, cloud: Cloud, rocket: Rocket } }
];

let previousFormatSource: FormatSource;

beforeEach(() => {
    previousFormatSource = setFormatSource(fakeFormatSource());
});

afterEach(() => {
    setFormatSource(previousFormatSource);
});

const render = (node: ReactNode): string => renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);

describe('an icon picker', () => {
    test('offers to clear a chosen icon beside the trigger, and nothing to clear while there is none', () => {
        const chosen = render(<IconPicker icons={GROUPS} value="cloud" onValueChange={() => {}} onClear={() => {}} />);
        expect(chosen).toContain('aria-label="No icon"');
        const none = render(<IconPicker icons={GROUPS} value={null} onValueChange={() => {}} onClear={() => {}} />);
        expect(none).not.toContain('aria-label="No icon"');
    });

    test('keeps a hidden label as the name of its trigger', () => {
        const markup = render(<IconPicker icons={GROUPS} value={null} label="Symbol" hideLabel onValueChange={() => {}} />);
        expect(markup).toMatch(/<div id="[^"]+" class="[^"]*sr-only[^"]*"[^>]*>Symbol<\/div>/);
    });

    test('is a trigger drawn like a field under its label, naming the chosen icon', () => {
        const markup = render(<IconPicker icons={GROUPS} value="cloud" label="Symbol" onValueChange={() => {}} />);
        const labelId = /<div id="([^"]+)"[^>]*>Symbol<\/div>/.exec(markup)?.[1];
        const valueId = /<span id="([^"]+)"[^>]*>cloud<\/span>/.exec(markup)?.[1];
        expect(labelId).toBeDefined();
        expect(markup).toContain(`aria-labelledby="${labelId} ${valueId}"`);
        expect(markup).toMatch(/<button[^>]*class="field /);
        expect(markup).toContain('aria-haspopup="dialog"');
        expect(markup).not.toContain('role="radiogroup"');
    });

    test('says none while no icon is chosen', () => {
        const markup = render(<IconPicker icons={GROUPS} value={null} onValueChange={() => {}} />);
        expect(markup).toContain('>Icon</div>');
        expect(markup).toMatch(/<span id="[^"]+" class="[^"]*text-text-faint[^"]*">None<\/span>/);
    });

    test('cannot open while disabled', () => {
        expect(render(<IconPicker icons={GROUPS} value={null} disabled onValueChange={() => {}} />)).toMatch(/<button[^>]*disabled=""/);
    });
});
