import { expect, test } from 'bun:test';
import { UIProvider } from '@adecore/ui';
import i18next from 'i18next';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Chart } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

interface Folder {
    readonly path: string;
    readonly code: number;
    readonly tests: number;
}

const FOLDERS: Folder[] = [
    { path: 'packages/editor/src/language', code: 60, tests: 20 },
    { path: 'packages/ui', code: 40, tests: 10 },
    { path: 'docs', code: 30, tests: 0 },
    { path: 'scripts', code: 10, tests: 5 }
];

function wrap(node: ReactNode): ReactNode {
    return <UIProvider i18n={i18n}>{node}</UIProvider>;
}

test('a horizontal chart takes its height from its rows and says how to move between them', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Chart.Root data={FOLDERS} x="path" orientation="horizontal" rowHeight={30} label="Lines per folder">
                <Chart.Bar value="code" label="Code" />
            </Chart.Root>
        )
    );

    // 8 over the plot and four rows of 30.
    expect(markup).toContain('height="128"');
    expect(markup).toContain('Up and Down move between rows');
});
