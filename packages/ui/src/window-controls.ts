import { useSyncExternalStore } from 'react';

/* The app hands it over once, before the first render, from what its shell reports for the window. */
export interface WindowControlsSource {
    /* The width to keep free at the start of the first column, in pixels; `null` where the window draws no controls there. */
    inset(): number | null;

    subscribe(onChange: () => void): () => void;
}

let source: WindowControlsSource = { inset: () => null, subscribe: () => () => {} };

/* Answers the source it replaced, so a test can put that one back. */
export const setWindowControlsSource = (next: WindowControlsSource): WindowControlsSource => {
    const previous = source;
    source = next;

    return previous;
};

const subscribe = (onChange: () => void): (() => void) => source.subscribe(onChange);

const inset = (): number | null => source.inset();

/* The width to keep free for the window's own controls, or `undefined` where there are none or they are hidden, as in fullscreen. */
export const useWindowControlsInset = (): number | undefined => useSyncExternalStore(subscribe, inset, inset) ?? undefined;
