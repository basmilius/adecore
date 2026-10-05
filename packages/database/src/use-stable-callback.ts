import { useCallback, useLayoutEffect, useRef } from 'react';

/* A function that never changes identity and always calls the latest `callback`, so a provider value built on it does not rebuild on each render. */
export function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result {
    const latest = useRef(callback);

    useLayoutEffect(() => {
        latest.current = callback;
    });

    return useCallback((...args: Args) => latest.current(...args), []);
}
