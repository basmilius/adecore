import type { SeriesLegendItem } from './SeriesLegend.tsx';

/* The items whose label or full name holds the query, ignoring case and the space around it. */
export function matchingItems<Item extends SeriesLegendItem>(items: readonly Item[], query: string): Item[] {
    const needle = query.trim().toLocaleLowerCase();

    return needle === '' ? [...items] : items.filter((item) => [item.label, item.name ?? ''].some((text) => text.toLocaleLowerCase().includes(needle)));
}

/* The hidden keys after a group is turned on or off as a whole; a disabled series stays as it is. */
export function toggleGroup(items: readonly SeriesLegendItem[], hidden: readonly string[], group: string, show: boolean): string[] {
    const members = new Set(items.filter((item) => item.group === group && item.disabled !== true).map((item) => item.key));
    const rest = hidden.filter((key) => !members.has(key));

    return show ? rest : [...rest, ...members];
}
