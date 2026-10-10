import { useEffect, useState } from 'react';
import type { Connection } from '@adecore/database';

const STORAGE_KEY = 'database-example:connections';

function read(): readonly Connection[] | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw === null ? null : (JSON.parse(raw) as Connection[]);
    } catch {
        return null;
    }
}

/* The saved connections. A first start has none stored, and gets the demo database. */
export function useConnections(): readonly [readonly Connection[], (next: readonly Connection[]) => void] {
    const [connections, setConnections] = useState<readonly Connection[]>(() => read() ?? []);

    const save = (next: readonly Connection[]): void => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setConnections(next);
    };

    useEffect(() => {
        if (read() !== null) {
            return;
        }

        window.database.demoPath().then(
            (path) => save([{ id: 'demo-shop', name: 'Demo shop', config: { engine: 'sqlite', path } }]),
            (e: unknown) => console.error('The demo database could not be created.', e)
        );
    }, []);

    return [connections, save];
}
