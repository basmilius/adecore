export interface SeriesLegendItem {
    readonly key: string;
    readonly label: string;
    /* The full name a screen reader and the hint give, such as with the name of its group; `label` by default. */
    readonly name?: string;
    /* The key of the group it is listed under. */
    readonly group?: string;
    /* A CSS color of the app's own, such as a variable; the mark and the check take it. */
    readonly color?: string;
    /* A series that has nothing to show: listed, but it cannot be turned on. */
    readonly disabled?: boolean;
    /* Why the series shows less than it could, such as "Turned off", under its name and in its hint. */
    readonly status?: string;
}

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
