/* The items in order, without any whose key an earlier one had. */
export function uniqueBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = keyOf(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export function placeKey(location: {
    readonly uri: string;
    readonly range: { readonly start: { readonly line: number; readonly character: number } };
}): string {
    return `${location.uri}\0${location.range.start.line}\0${location.range.start.character}`;
}
