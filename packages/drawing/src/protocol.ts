import { z } from 'zod';

export const DrawingFontSchema = z.enum(['hand', 'sans', 'mono']);
export type DrawingFont = z.infer<typeof DrawingFontSchema>;

/*
 * Palette names keep a document independent of the theme that renders it.
 */
export const DrawingColorSchema = z.enum(['ink', 'muted', 'accent', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
export type DrawingColor = z.infer<typeof DrawingColorSchema>;

/* In the order the color menu shows them. */
export const DRAWING_COLORS = DrawingColorSchema.options;

export const DrawingFillSchema = z.enum(['none', 'solid', 'hachure']);
export type DrawingFill = z.infer<typeof DrawingFillSchema>;

export const DrawingStrokeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);
export type DrawingStrokeStyle = z.infer<typeof DrawingStrokeStyleSchema>;

export const DrawingStrokeWidthSchema = z.union([z.literal(1), z.literal(2), z.literal(4)]);
export type DrawingStrokeWidth = z.infer<typeof DrawingStrokeWidthSchema>;

/* Architect, Artist, Cartoonist. Absent reads as 1, so a file written by hand looks hand drawn. */
export const DrawingRoughnessSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type DrawingRoughness = z.infer<typeof DrawingRoughnessSchema>;

export const DrawingAlignSchema = z.enum(['left', 'center', 'right']);
export type DrawingAlign = z.infer<typeof DrawingAlignSchema>;

export const DRAWING_TEXT_SIZE_MIN = 12;
export const DRAWING_TEXT_SIZE_MAX = 96;

const ElementBaseSchema = z.object({
    id: z.string().min(1),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    // Radians around the center; absent means 0.
    angle: z.number().optional(),
    stroke: DrawingColorSchema,
    strokeWidth: DrawingStrokeWidthSchema,
    strokeStyle: DrawingStrokeStyleSchema.optional(),
    fill: DrawingFillSchema.optional(),
    fillColor: DrawingColorSchema.optional(),
    roughness: DrawingRoughnessSchema.optional(),
    // Keeps the wobble the same on every render, on every machine.
    seed: z.number().int().nonnegative(),
    locked: z.boolean().optional()
});

export const DrawingElementSchema = z.discriminatedUnion('kind', [
    ElementBaseSchema.extend({ kind: z.literal('rect'), radius: z.number().nonnegative().optional() }),
    ElementBaseSchema.extend({ kind: z.literal('diamond') }),
    ElementBaseSchema.extend({ kind: z.literal('ellipse') }),
    // Points are relative to (x, y) and their bounds are the box. An arrow is a line with a head.
    ElementBaseSchema.extend({
        kind: z.literal('line'),
        points: z.array(z.tuple([z.number(), z.number()])).min(2),
        arrowStart: z.boolean().optional(),
        arrowEnd: z.boolean().optional()
    }),
    // A stroke: relative points with an optional pressure, drawn through perfect-freehand.
    ElementBaseSchema.extend({
        kind: z.literal('freehand'),
        points: z.array(z.tuple([z.number(), z.number(), z.number().optional()])).min(1)
    }),
    ElementBaseSchema.extend({
        kind: z.literal('text'),
        text: z.string(),
        size: z.number().int().min(DRAWING_TEXT_SIZE_MIN).max(DRAWING_TEXT_SIZE_MAX),
        // Absent means 'hand', the default a drawing is written in.
        font: DrawingFontSchema.optional(),
        align: DrawingAlignSchema.optional(),
        // Set once the box was dragged by hand; absent means the box follows the glyphs.
        sized: z.boolean().optional()
    }),
    /*
     * A sticky note: a sheet of paper in `fillColor` with the text written on it. It is one element
     * rather than a shape with a text on top, so moving the note takes what it says along.
     */
    ElementBaseSchema.extend({
        kind: z.literal('note'),
        text: z.string(),
        size: z.number().int().min(DRAWING_TEXT_SIZE_MIN).max(DRAWING_TEXT_SIZE_MAX),
        font: DrawingFontSchema.optional(),
        align: DrawingAlignSchema.optional()
    })
]);
export type DrawingElement = z.infer<typeof DrawingElementSchema>;
export type DrawingElementKind = DrawingElement['kind'];

export const DRAWING_VERSION = 1;

export const DrawingContentSchema = z.object({
    // In stacking order, back to front.
    elements: z.array(DrawingElementSchema)
});
export type DrawingContent = z.infer<typeof DrawingContentSchema>;

export const DrawingDocumentSchema = DrawingContentSchema.extend({
    version: z.literal(DRAWING_VERSION),
    // Goes up by one on every write; a save that names an older rev is a conflict.
    rev: z.number().int().nonnegative()
});
export type DrawingDocument = z.infer<typeof DrawingDocumentSchema>;

export const EMPTY_DRAWING: DrawingDocument = { version: 1, rev: 0, elements: [] };

/* One version so far, so reading is a parse. A file that is not a drawing at all reads as null. */
export function migrateDrawing(value: unknown): DrawingDocument | null {
    const parsed = DrawingDocumentSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

/*
 * Element ids never leave their own file, so they only have to be unique inside it. A repeat would
 * make selection and hit tests pick two elements at once, so such a file is refused by name.
 */
export function duplicateElementIdIn(elements: DrawingElement[]): string | null {
    const seen = new Set<string>();
    for (const element of elements) {
        if (seen.has(element.id)) {
            return element.id;
        }
        seen.add(element.id);
    }
    return null;
}
