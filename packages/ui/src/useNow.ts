import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/* Starts at the time it was mounted, so a panel that comes back mid-session does not read zero for a second first. */
export const useNow = (intervalMs: number, ticking = true): number => {
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        if (!ticking) {
            return;
        }
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs, ticking]);

    return now;
};

/* Written straight into the node: a thread that re-renders every second re-renders every row it draws with it. */
export const useTickingText = (render: () => string, intervalMs = 1000): RefObject<HTMLSpanElement | null> => {
    const ref = useRef<HTMLSpanElement>(null);
    const latest = useRef(render);

    const tick = useCallback((): void => {
        if (ref.current !== null) {
            ref.current.textContent = latest.current();
        }
    }, []);

    useEffect(() => {
        const timer = window.setInterval(tick, intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs, tick]);

    /* After every render as well, so a language or region change lands without waiting for the next tick. */
    useEffect(() => {
        latest.current = render;
        tick();
    });

    return ref;
};
