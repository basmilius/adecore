import { useState, useSyncExternalStore } from 'react';
import type { DatabaseFiles, DatabaseStorage, NumberNotation } from '@adecore/database';
import { formatRegionFrom, type FormatSource } from '@adecore/ui/format';
import { i18n } from './i18n.ts';

/* What the views keep across a remount goes to the page's own storage. */
export const databaseStorage: DatabaseStorage = {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => {
        if (value === null) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
        }
    }
};

/* The main process shows the dialogs and remembers the paths they returned, which are the only files the host reads or writes. */
export const databaseFiles: DatabaseFiles = {
    save: (options) => window.database.saveFile(options),
    open: (options) => window.database.openFile(options)
};

export type Layout = 'workbench' | 'pane';

const LAYOUT_KEY = 'database-example:layout';

/* Which of the two layouts the window shows, kept for the next start. */
export const useLayout = (): readonly [Layout, (next: Layout) => void] => {
    const [layout, setLayout] = useState<Layout>(() => (localStorage.getItem(LAYOUT_KEY) === 'pane' ? 'pane' : 'workbench'));

    const change = (next: Layout): void => {
        localStorage.setItem(LAYOUT_KEY, next);
        setLayout(next);
    };

    return [layout, change];
};

const REGION_KEY = 'database-example:region';
const NOTATION_KEY = 'database-example:notation';

const listeners = new Set<() => void>();
let region = formatRegionFrom(localStorage.getItem(REGION_KEY));
let notation: NumberNotation = localStorage.getItem(NOTATION_KEY) === 'region' ? 'region' : 'database';

const subscribe = (onChange: () => void): (() => void) => {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
};

/* What the formatters of `@adecore/ui` read: the language of the interface and the region the person picked. */
export const formatSource: FormatSource = {
    language: () => i18n.language,
    region: () => region,
    subscribe
};

/* The region the numbers, dates and durations are written in, kept for the next start. */
export const useRegion = (): readonly [string, (next: string) => void] => {
    const current = useSyncExternalStore(subscribe, () => region);

    const change = (next: string): void => {
        region = next;
        localStorage.setItem(REGION_KEY, next);
        listeners.forEach((listener) => listener());
    };

    return [current, change];
};

/* Whether the cells show numbers as the database wrote them or in the region's notation, kept for the next start. */
export const useNumberNotation = (): readonly [NumberNotation, (next: NumberNotation) => void] => {
    const current = useSyncExternalStore(subscribe, () => notation);

    const change = (next: NumberNotation): void => {
        notation = next;
        localStorage.setItem(NOTATION_KEY, next);
        listeners.forEach((listener) => listener());
    };

    return [current, change];
};
