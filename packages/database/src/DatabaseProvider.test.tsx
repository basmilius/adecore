import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import type { DatabaseAction, DatabaseFiles, DatabaseStorage } from './actions.ts';
import { useDatabaseAction, useDatabaseClient, useDatabaseFiles, useDatabaseStorage, useNumberNotation } from './client-context.ts';
import { DatabaseProvider } from './DatabaseProvider.tsx';
import { stubClient } from './testing/stub.ts';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const outerClient = stubClient({});
const innerClient = stubClient({});
const storage: DatabaseStorage = { get: () => null, set: () => {} };
const files: DatabaseFiles = { save: async () => null, open: async () => null };

interface Seen {
    client: unknown;
    storage: unknown;
    files: unknown;
    notation: string;
    act: ((action: DatabaseAction) => void) | undefined;
}

let seen: Seen = { client: undefined, storage: undefined, files: undefined, notation: '', act: undefined };

function Probe({ report }: { report(value: Seen): void }) {
    report({
        client: useDatabaseClient(),
        storage: useDatabaseStorage(),
        files: useDatabaseFiles(),
        notation: useNumberNotation(),
        act: useDatabaseAction()
    });
    return null;
}

const report = (value: Seen): void => {
    seen = value;
};

const render = (node: ReactNode): void => {
    renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);
};

describe('DatabaseProvider', () => {
    test('hands the views what it was given', () => {
        const actions: DatabaseAction[] = [];
        render(
            <DatabaseProvider client={outerClient} storage={storage} files={files} numberNotation="region" onAction={(action) => actions.push(action)}>
                <Probe report={report} />
            </DatabaseProvider>
        );
        expect(seen.client).toBe(outerClient);
        expect(seen.storage).toBe(storage);
        expect(seen.files).toBe(files);
        expect(seen.notation).toBe('region');
        seen.act?.({ kind: 'open-console', connectionId: 'shop' });
        expect(actions).toEqual([{ kind: 'open-console', connectionId: 'shop' }]);
    });

    test('draws numbers as the database writes them by default', () => {
        render(
            <DatabaseProvider client={outerClient}>
                <Probe report={report} />
            </DatabaseProvider>
        );
        expect(seen.notation).toBe('database');
        expect(seen.act).toBeUndefined();
        expect(seen.storage).toBeUndefined();
    });

    test('inside another, takes what it leaves out from the one above and overrides what it sets', () => {
        const outer: DatabaseAction[] = [];
        const inner: DatabaseAction[] = [];
        render(
            <DatabaseProvider client={outerClient} storage={storage} files={files} numberNotation="region" onAction={(action) => outer.push(action)}>
                <DatabaseProvider onAction={(action) => inner.push(action)}>
                    <Probe report={report} />
                </DatabaseProvider>
            </DatabaseProvider>
        );
        expect(seen.client).toBe(outerClient);
        expect(seen.storage).toBe(storage);
        expect(seen.files).toBe(files);
        expect(seen.notation).toBe('region');
        seen.act?.({ kind: 'open-console', connectionId: 'shop' });
        expect(inner).toHaveLength(1);
        expect(outer).toHaveLength(0);

        render(
            <DatabaseProvider client={outerClient} onAction={(action) => outer.push(action)}>
                <DatabaseProvider client={innerClient} numberNotation="database">
                    <Probe report={report} />
                </DatabaseProvider>
            </DatabaseProvider>
        );
        expect(seen.client).toBe(innerClient);
        expect(seen.notation).toBe('database');
        seen.act?.({ kind: 'open-console', connectionId: 'shop' });
        expect(outer).toHaveLength(1);
    });

    test('needs a client of its own or one above it', () => {
        expect(() =>
            render(
                <DatabaseProvider>
                    <Probe report={report} />
                </DatabaseProvider>
            )
        ).toThrow('A DatabaseProvider needs a client');
    });
});
