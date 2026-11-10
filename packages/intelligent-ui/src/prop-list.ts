import type { z } from 'zod';

/* What a host does with a Place: `coordinates` when the agent gives lat and lon, `addresses` when the host also looks an address up. */
export type UiPlaces = 'coordinates' | 'addresses';

/* What an entry says to a host that looks addresses up: its own description and needs, and the prop only such a host reads. */
interface UiLookup {
    readonly prop: string;
    readonly description: string;
    readonly needs: string;
}

interface UiPrintedEntry {
    readonly schema: { readonly shape: Readonly<Record<string, z.ZodType>> };
    readonly action?: string;
    readonly needs?: string;
    readonly text?: string;
    readonly lookup?: UiLookup;
}

/* The props a catalog entry accepts, its action first and an optional one marked with `?`. */
export function uiPropList(entry: UiPrintedEntry, places: UiPlaces = 'coordinates'): string[] {
    const props = Object.entries(entry.schema.shape)
        .filter(([key]) => places === 'addresses' || key !== entry.lookup?.prop)
        .map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`);

    return entry.action ? [entry.action, ...props] : props;
}

/* The description of an entry as the host that places this way reads it. */
export function uiDescription(entry: { readonly description: string; readonly lookup?: UiLookup }, places: UiPlaces = 'coordinates'): string {
    return places === 'addresses' && entry.lookup ? entry.lookup.description : entry.description;
}

/* What a component needs in the compact note: the props it cannot do without and, when its text is not the plain content, what that text is. */
export function uiRequirement(name: string, entry: UiPrintedEntry, places: UiPlaces = 'coordinates'): string {
    const required =
        (places === 'addresses' ? entry.lookup?.needs : undefined) ??
        entry.needs ??
        uiPropList(entry, places)
            .filter((prop) => !prop.endsWith('?'))
            .join(' ');

    return `${name}${required ? ` ${required}` : ''}${entry.text ? ` (text: ${entry.text})` : ''}`;
}
