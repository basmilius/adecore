import { z } from 'zod';
import type { UiExpression, UiValue } from './expression.ts';

const position = z.number().int().nonnegative();

// Props and expressions stay open on the wire, so a block from a newer catalog still parses; the bounded interpreter validates their use. They are typed as the compiler writes them.
const values = z.record(z.string(), z.unknown()) as z.ZodType<Record<string, UiValue>>;
const expressions = z.record(z.string(), z.unknown()) as z.ZodType<Record<string, UiExpression>>;
const expression = z.unknown() as z.ZodType<UiExpression>;

export const UiNodeSchema = z.object({
    id: z.string(),
    type: z.string(),
    props: values,
    expressions,
    bindings: z.record(z.string(), z.string()),
    get children(): z.ZodArray<typeof UiNodeSchema> {
        return z.array(UiNodeSchema);
    },
    complete: z.boolean(),
    fallback: z.string(),
    error: z.string().optional(),
    start: position,
    end: position
});

export type UiNode = z.infer<typeof UiNodeSchema>;

export const UiDiagnosticSchema = z.object({
    code: z.string(),
    message: z.string(),
    start: position,
    end: position,
    nodeId: z.string().optional(),
    // A warning leaves the part it names drawn. Absent means an error, a part that could not be drawn.
    severity: z.literal('warning').optional()
});

export type UiDiagnostic = z.infer<typeof UiDiagnosticSchema>;

export const UiQuerySchema = z.object({ source: z.string(), args: values, expression: expression.optional() });

export type UiQuery = z.infer<typeof UiQuerySchema>;

export const UiBlockSchema = z.object({
    id: z.string(),
    catalogVersion: position,
    revision: z.string().min(1).optional(),
    start: position,
    end: position,
    complete: z.boolean(),
    defaults: values,
    queries: z.record(z.string(), UiQuerySchema),
    nodes: z.array(UiNodeSchema),
    diagnostics: z.array(UiDiagnosticSchema),
    fallback: z.string()
});

export type UiBlock = z.infer<typeof UiBlockSchema>;

export const UiBlocksSchema = z.array(UiBlockSchema);
