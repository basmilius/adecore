import { Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { readLandings, subscribeLandings } from './lazy-landings.ts';

export interface LazyBoundaryProps {
    readonly fallback?: ReactNode;
    readonly children?: ReactNode;
}

/*
 * React holds content that comes in as a retry back until 300 ms after its fallback showed; this
 * boundary draws again as an ordinary update once a module lands, so a 20 ms chunk shows after 20 ms.
 */
export function LazyBoundary({ fallback = null, children }: LazyBoundaryProps) {
    // Compiled, the same boundary would come back and the landing would wait for React's own retry after all.
    'use no memo';
    useSyncExternalStore(subscribeLandings, readLandings, readLandings);
    return <Suspense fallback={fallback}>{children}</Suspense>;
}
