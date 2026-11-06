import { expect, test } from 'bun:test';
import { UIProvider } from '@adecore/ui';
import i18next from 'i18next';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Timeline, type TimelineSpan } from './index.ts';
import { CHARTS_NAMESPACE, CHARTS_RESOURCES } from './locales.ts';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: { en: { [CHARTS_NAMESPACE]: CHARTS_RESOURCES.en! } }, interpolation: { escapeValue: false } });

const SPANS: TimelineSpan[] = [
    { id: 'request', parent: null, label: 'GET /orders', start: 1000, duration: 340, kind: 'http' },
    { id: 'query', parent: 'request', label: 'SELECT orders', start: 1012, duration: 40, kind: 'db' },
    { id: 'render', parent: 'request', label: 'render', start: 1100, duration: 200 },
    { id: 'partial', parent: 'render', label: 'partial', start: 1150, duration: 30 }
];

const KINDS = [
    { id: 'db', label: 'Database' },
    { id: 'http', label: 'Network' }
];

const wrap = (node: ReactNode): ReactNode => <UIProvider i18n={i18n}>{node}</UIProvider>;

test('a row is named by its label, kind, start and duration', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Timeline.Root data={SPANS} kinds={KINDS} label="Spans">
                <Timeline.Rows />
            </Timeline.Root>
        )
    );

    expect(markup).toContain('role="tree"');
    expect(markup).toContain('aria-label="SELECT orders, Database, starts at +12 ms, takes 40 ms"');
});

test('the keyboard hint stands beside the tree, where it is no item of it', () => {
    const markup = renderToStaticMarkup(
        wrap(
            <Timeline.Root data={SPANS} kinds={KINDS} label="Spans">
                <Timeline.Rows />
            </Timeline.Root>
        )
    );

    const hintId = /role="tree"[^>]*aria-describedby="([^"]+)"/.exec(markup)![1]!;
    const tree = markup.slice(markup.indexOf('role="tree"'), markup.lastIndexOf('role="treeitem"'));
    expect(tree).not.toContain(`id="${hintId}"`);
    expect(markup).toContain(`id="${hintId}"`);
});
