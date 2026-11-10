import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setFormatSource, type FormatSource } from './format/locale.ts';
import { Slider } from './Slider.tsx';
import { fakeFormatSource } from './testing/fake-source.ts';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

let previousFormatSource: FormatSource;

beforeEach(() => {
    previousFormatSource = setFormatSource(fakeFormatSource());
});

afterEach(() => {
    setFormatSource(previousFormatSource);
});

const render = (node: ReactNode): string => renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);

describe('a slider', () => {
    test('names its range input after the visible label and says the value with its unit', () => {
        const markup = render(<Slider label="Opacity" value={0.4} onValueChange={() => {}} min={0} max={1} step={0.05} unit="%" />);
        const labelId = /<span id="([^"]+)"[^>]*>Opacity<\/span>/.exec(markup)?.[1];
        expect(labelId).toBeDefined();
        expect(markup).toContain('type="range"');
        expect(markup).toContain(`aria-labelledby="${labelId}"`);
        expect(markup).toContain('aria-valuenow="0.4"');
        expect(markup).toContain('aria-valuetext="0.40%"');
        expect(markup).toContain('min="0"');
        expect(markup).toContain('max="1"');
        expect(markup).toContain('step="0.05"');
    });

    test('writes the value with the places of its step unless told otherwise', () => {
        expect(render(<Slider label="Agents" value={8} onValueChange={() => {}} min={1} max={16} />)).toContain('aria-valuetext="8"');
        expect(render(<Slider label="Scale" value={2} onValueChange={() => {}} min={1} max={3} step={0.5} decimals={2} />)).toContain('aria-valuetext="2.00"');
    });

    test('turns its input off when disabled', () => {
        const markup = render(<Slider label="Agents" value={8} onValueChange={() => {}} min={1} max={16} disabled />);
        expect(markup).toContain('data-disabled');
        expect(markup).toMatch(/<input[^>]*disabled/);
    });
});
