import { useEffect, useRef, useState } from 'react';
import { messageOf } from '@adecore/ui';

export interface Loaded<T> {
    /* The last value that arrived for this key; stays while the next one loads, so a page does not vanish under a reload. */
    value: T | null;
    loading: boolean;
    error: string | null;
    reload(): void;
}

interface State<T> {
    key: string;
    version: number;
    value: T | null;
    error: string | null;
}

/*
 * Runs `load` when `key` changes or `reload` is called, and aborts the run that is still going.
 * `key` has to name everything `load` reads, since `load` itself is a new function on every render.
 */
export function useLoaded<T>(load: (signal: AbortSignal) => Promise<T>, key: string): Loaded<T> {
    const loader = useRef(load);
    const [version, setVersion] = useState(0);
    // Loading is not a state of its own: it is that the last answer is not for this key and this version.
    const [state, setState] = useState<State<T>>({ key: '', version: -1, value: null, error: null });

    useEffect(() => {
        loader.current = load;
    });

    useEffect(() => {
        const controller = new AbortController();
        loader.current(controller.signal).then(
            (value) => {
                if (!controller.signal.aborted) {
                    setState({ key, version, value, error: null });
                }
            },
            (error: unknown) => {
                if (!controller.signal.aborted) {
                    setState((now) => ({ key, version, value: now.key === key ? now.value : null, error: messageOf(error) }));
                }
            }
        );
        return () => controller.abort();
    }, [key, version]);

    const sameKey = state.key === key;
    const answered = sameKey && state.version === version;
    return {
        value: sameKey ? state.value : null,
        loading: !answered,
        error: answered ? state.error : null,
        reload: () => setVersion((now) => now + 1)
    };
}
