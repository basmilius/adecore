import { expect, test } from 'bun:test';
import { UIProvider } from '@adecore/ui';
import i18next from 'i18next';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Heatmap } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

const ROWS = [
    { key: 'mon', label: 'Monday', short: 'Mon' },
    { key: 'tue', label: 'Tuesday', short: 'Tue' }
];

const COLUMNS = [
    { key: 0, label: '00:00', short: '0' },
    { key: 1, label: '01:00', short: null },
    { key: 2, label: '02:00', short: null }
];

const VALUES = [
    [0, 1, 100],
    [null, 50, 4]
];

const wrap = (node: ReactNode): ReactNode => <UIProvider i18n={i18n}>{node}</UIProvider>;

const heatmap = <Heatmap rows={ROWS} columns={COLUMNS} values={VALUES} label="Events per weekday and hour" valueLabel="Events" />;

test('a heatmap is one named stop for the keyboard with every value in a table', () => {
    const markup = renderToStaticMarkup(wrap(heatmap));
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-roledescription="heatmap"');
    expect(markup).toContain('aria-label="Events per weekday and hour"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('Arrow keys move between cells');
    expect(markup).toContain('<th scope="row">Tuesday</th><td></td><td>50</td><td>4</td>');
});
