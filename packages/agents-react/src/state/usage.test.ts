import { describe, expect, test } from 'bun:test';
import { askedKey, reloadUsagePreferences, summaryPayload, USAGE_PREFERENCES_KEY, useUsageStore } from './usage';

describe('the summary question', () => {
    test('a picked account is part of what was asked', () => {
        const now = new Date(2026, 8, 25, 12);
        expect(summaryPayload('7d', 'claude_work', now).accounts).toEqual(['claude_work']);
        expect(summaryPayload('7d', null, now).accounts).toBeUndefined();
        expect(askedKey(summaryPayload('7d', 'claude_work', now))).not.toBe(askedKey(summaryPayload('7d', null, now)));
    });
});

describe('the usage preferences', () => {
    test('follow what another window wrote', () => {
        const stored = new Map<string, string>();
        const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) };
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

        try {
            storage.setItem(USAGE_PREFERENCES_KEY, JSON.stringify({ period: '30d', metric: 'tokens', currency: 'EUR' }));
            reloadUsagePreferences();
            expect(useUsageStore.getState()).toMatchObject({ period: '30d', metric: 'tokens', currency: 'EUR' });
            storage.setItem(USAGE_PREFERENCES_KEY, JSON.stringify({ period: 'forever' }));
            reloadUsagePreferences();
            expect(useUsageStore.getState()).toMatchObject({ period: '7d', metric: 'cost', currency: 'USD' });
        } finally {
            if (previous) {
                Object.defineProperty(globalThis, 'localStorage', previous);
            } else {
                delete (globalThis as { localStorage?: unknown }).localStorage;
            }
        }
    });

    test('keep the last exchange rate a summary brought, for a window that has not asked for one yet', () => {
        const stored = new Map<string, string>();
        const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) };
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        const rate = { currency: 'EUR', rate: 0.92, date: '2026-11-03', fetchedAt: 1 };
        Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

        try {
            useUsageStore.getState().receive('scope', 'asked', { rate } as Parameters<ReturnType<typeof useUsageStore.getState>['receive']>[2]);
            useUsageStore.setState({ rate: null });
            reloadUsagePreferences();
            expect(useUsageStore.getState().rate).toEqual(rate);

            storage.setItem(USAGE_PREFERENCES_KEY, JSON.stringify({ rate: { currency: 'EUR' } }));
            reloadUsagePreferences();
            expect(useUsageStore.getState().rate).toBeNull();
        } finally {
            useUsageStore.getState().forget('scope');
            if (previous) {
                Object.defineProperty(globalThis, 'localStorage', previous);
            } else {
                delete (globalThis as { localStorage?: unknown }).localStorage;
            }
        }
    });
});
