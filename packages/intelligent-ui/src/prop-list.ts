import type { z } from 'zod';
import { uiInnerSchema, uiPropOptions } from './normalize.ts';

export const UI_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

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

interface Inner {
    def: { type: string; options?: readonly z.ZodType[]; defaultValue?: unknown };
}

/* What a prop takes, as the catalog prints it: `text`, `number`, `boolean`, `list`, `scalar`, `tone` or the values of an enum. */
export function uiPropType(schema: z.ZodType): string {
    const inner = uiInnerSchema(schema);
    const { def } = inner as unknown as Inner;
    const options = uiPropOptions(inner);

    if (options !== null) {
        return options.join('|') === UI_TONES.join('|') ? 'tone' : options.join('|');
    }

    switch (def.type) {
        case 'string':
            return 'text';
        case 'array':
            return 'list';
        case 'union': {
            const kinds = (def.options ?? []).map((option) => uiPropType(option));

            return kinds.includes('boolean') ? 'scalar' : [...new Set(kinds)].join('|');
        }
        default:
            return def.type;
    }
}

function defaultOf(schema: z.ZodType): string {
    const { def } = schema as unknown as Inner;

    return def.type === 'default' ? ` = ${String(def.defaultValue)}` : '';
}

function listed(entry: UiPrintedEntry, places: UiPlaces): [string, z.ZodType][] {
    return Object.entries(entry.schema.shape).filter(([key]) => places === 'addresses' || key !== entry.lookup?.prop);
}

/*
 * The props a catalog entry accepts, its action first: an optional one marked with `?`, then what it
 * takes unless that is text, and the value it has when left out.
 */
export function uiPropList(entry: UiPrintedEntry, places: UiPlaces = 'coordinates'): string[] {
    const props = listed(entry, places).map(([key, schema]) => {
        const type = uiPropType(schema);

        return `${key}${schema.isOptional() ? '?' : ''}${type === 'text' ? '' : `: ${type}`}${defaultOf(schema)}`;
    });

    return entry.action ? [entry.action, ...props] : props;
}

/* A required prop the way an agent writes it: text bare, an enum with its values, the rest in braces. */
function writtenProp(key: string, schema: z.ZodType): string {
    const type = uiPropType(schema);

    if (type === 'text' || type === 'scalar') {
        return key;
    }

    if (uiPropOptions(schema) !== null) {
        return `${key}=${type}`;
    }

    return `${key}={${type === 'number|text' ? 'number' : type}}`;
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
        [
            ...(entry.action ? [entry.action] : []),
            ...listed(entry, places)
                .filter(([, schema]) => !schema.isOptional())
                .map(([key, schema]) => writtenProp(key, schema))
        ].join(' ');

    return `${name}${required ? ` ${required}` : ''}${entry.text ? ` (text: ${entry.text})` : ''}`;
}
