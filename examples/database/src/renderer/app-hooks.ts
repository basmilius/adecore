import { useState } from 'react';
import type { DatabaseFiles, DatabaseStorage } from '@adecore/database';

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
