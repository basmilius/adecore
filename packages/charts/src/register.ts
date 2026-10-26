import { useEffect, useLayoutEffect } from 'react';
import { warnMissingKey } from './access.ts';
import type { BandEntry, ChartStore, MarkerEntry, RuleEntry, SeriesEntry } from './store.ts';

/* Before paint on a page, and a plain effect on the server, where a layout effect has nothing to wait for. */
export const useBeforePaint = typeof document === 'undefined' ? useEffect : useLayoutEffect;

interface Entries {
    series: SeriesEntry;
    marker: MarkerEntry;
    band: BandEntry;
    rule: RuleEntry;
}

const write = <Kind extends keyof Entries>(store: ChartStore, kind: Kind, id: string, entry: Entries[Kind] | null): void => {
    if (kind === 'series') {
        store.setSeries(id, entry as SeriesEntry | null);
    } else if (kind === 'marker') {
        store.setMarker(id, entry as MarkerEntry | null);
    } else if (kind === 'rule') {
        store.setRule(id, entry as RuleEntry | null);
    } else {
        store.setBand(id, entry as BandEntry | null);
    }
};

/*
 * Tells the root about a part on every render, before paint, and takes it out on unmount. The removal
 * stays apart from the update, or every update would move the part to the end.
 */
export function useRegistration<Kind extends keyof Entries>(store: ChartStore, kind: Kind, id: string, entry: Entries[Kind]): void {
    useBeforePaint(() => {
        write(store, kind, id, entry);
    });

    useBeforePaint(() => () => write(store, kind, id, null), [store, kind, id]);
}

/* The warning of a key the rows do not have, once the data is there. */
export function useKeyCheck(accessor: unknown, data: readonly unknown[], part: string): void {
    useEffect(() => {
        warnMissingKey(accessor, data, part);
    }, [accessor, data, part]);
}
