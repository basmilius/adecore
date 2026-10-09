import type { z } from 'zod';

/* The props a catalog entry accepts, its action first and an optional one marked with `?`. */
export function uiPropList(entry: { readonly schema: { readonly shape: Readonly<Record<string, z.ZodType>> }; readonly action?: string }): string[] {
    const props = Object.entries(entry.schema.shape).map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`);
    return entry.action ? [entry.action, ...props] : props;
}
