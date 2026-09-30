import { describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { withClass } from './class-name.ts';
import { UI_NAMESPACE, UI_RESOURCES, addUiResources } from './locales.ts';
import { mergeRefs } from './merge-refs.ts';
import { activeZoomPreset, steppedZoom, ZOOM_PRESETS } from './zoom.ts';

describe('the classes of a part', () => {
    test('come before the caller’s, whether the caller hands a string or a function of the state', () => {
        expect(withClass('menu-item', 'grow')).toBe('menu-item grow');
        expect(withClass('menu-item', undefined)).toBe('menu-item');
        const fromState = withClass<{ open: boolean }>('menu-item', (state) => (state.open ? 'open' : undefined));
        expect(typeof fromState).toBe('function');
        expect((fromState as (state: { open: boolean }) => string)({ open: true })).toBe('menu-item open');
    });
});

describe('two refs on one element', () => {
    test('are both filled, an object and a callback alike', () => {
        const object: { current: string | null } = { current: null };
        const called: (string | null)[] = [];
        mergeRefs<string>(object, (node) => {
            called.push(node);
        })('node');
        expect(object.current).toBe('node');
        expect(called).toEqual(['node']);
    });
});

describe('the words of the library in an app', () => {
    test('are added in every language it ships, under their own namespace', async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ lng: 'en', resources: {} });
        addUiResources(i18n);
        for (const language of Object.keys(UI_RESOURCES)) {
            expect(i18n.hasResourceBundle(language, UI_NAMESPACE)).toBe(true);
        }
        expect(i18n.t('action.cancel', { ns: UI_NAMESPACE })).toBe('Cancel');
    });

    test('leave the words an app put there itself', async () => {
        const i18n = i18next.createInstance();
        await i18n.init({ lng: 'en', resources: { en: { [UI_NAMESPACE]: { action: { cancel: 'Never mind' } } } } });
        addUiResources(i18n);
        expect(i18n.t('action.cancel', { ns: UI_NAMESPACE })).toBe('Never mind');
    });
});

describe('zooming in steps', () => {
    test('ticks the preset the readout shows, rounded as it shows it', () => {
        expect(activeZoomPreset(0.999, ZOOM_PRESETS)).toBe(100);
        expect(activeZoomPreset(1.234, ZOOM_PRESETS)).toBeNull();
        expect(activeZoomPreset(3, [300])).toBe(300);
    });

    test('moves ten percent on the rounded readout, so plus and minus come back where they were', () => {
        expect(steppedZoom(1.004, 10)).toBe(1.1);
        expect(steppedZoom(steppedZoom(0.73, 10), -10)).toBe(0.73);
    });
});
