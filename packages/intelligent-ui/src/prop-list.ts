import type { z } from 'zod';

/* The props a catalog entry accepts, an optional one marked with `?`, in the order of its schema. */
export function uiPropList(entry: { readonly schema: { readonly shape: Readonly<Record<string, z.ZodType>> } }): string[] {
    return Object.entries(entry.schema.shape).map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`);
}
