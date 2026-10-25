import { z } from 'zod';
import {
    DRAWING_TEXT_SIZE_MAX,
    DRAWING_TEXT_SIZE_MIN,
    DrawingAlignSchema,
    DrawingColorSchema,
    DrawingElementSchema,
    DrawingFillSchema,
    DrawingFontSchema,
    DrawingRoughnessSchema,
    DrawingStrokeStyleSchema,
    DrawingStrokeWidthSchema,
    type DrawingElement
} from './protocol.ts';

/* How much one edit may touch, and how many elements a drawing may hold after it. */
export const DRAWING_EDIT_LIMITS = { perEdit: 200, elements: 5000 } as const;

const point = z.tuple([z.number(), z.number()]);
const pressurePoint = z.tuple([z.number(), z.number(), z.number().optional()]);
const textSize = z.number().int().min(DRAWING_TEXT_SIZE_MIN).max(DRAWING_TEXT_SIZE_MAX);

/* What an edit may set on any element. `id` and `seed` belong to whoever applies the edit, and `locked` to a person. */
const placed = {
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    angle: z.number().optional(),
    stroke: DrawingColorSchema.optional(),
    strokeWidth: DrawingStrokeWidthSchema.optional(),
    strokeStyle: DrawingStrokeStyleSchema.optional(),
    fill: DrawingFillSchema.optional(),
    fillColor: DrawingColorSchema.optional(),
    roughness: DrawingRoughnessSchema.optional()
};

const written = { text: z.string(), size: textSize.optional(), font: DrawingFontSchema.optional(), align: DrawingAlignSchema.optional() };

/* A new element without its id and seed; `stroke`, `strokeWidth` and a text's `size` take the defaults a drawing starts with. */
export const NewDrawingElementSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('rect'), ...placed, radius: z.number().nonnegative().optional() }),
    z.strictObject({ kind: z.literal('diamond'), ...placed }),
    z.strictObject({ kind: z.literal('ellipse'), ...placed }),
    z.strictObject({ kind: z.literal('line'), ...placed, points: z.array(point).min(2), arrowStart: z.boolean().optional(), arrowEnd: z.boolean().optional() }),
    z.strictObject({ kind: z.literal('freehand'), ...placed, points: z.array(pressurePoint).min(1) }),
    z.strictObject({ kind: z.literal('text'), ...placed, ...written }),
    z.strictObject({ kind: z.literal('note'), ...placed, ...written })
]);
export type NewDrawingElement = z.infer<typeof NewDrawingElementSchema>;

/* The fields an update may change on an element of one kind, besides the ones every kind has. */
const KIND_FIELDS: Record<DrawingElement['kind'], readonly string[]> = {
    rect: ['radius'],
    diamond: [],
    ellipse: [],
    line: ['points', 'arrowStart', 'arrowEnd'],
    freehand: ['points'],
    text: ['text', 'size', 'font', 'align'],
    note: ['text', 'size', 'font', 'align']
};

/* What changes on one element, by its id; its kind stays, and a field of another kind is refused once the element is known. */
export const DrawingElementPatchSchema = z.strictObject({
    id: z.string().min(1),
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().optional(),
    h: z.number().optional(),
    angle: z.number().optional(),
    stroke: DrawingColorSchema.optional(),
    strokeWidth: DrawingStrokeWidthSchema.optional(),
    strokeStyle: DrawingStrokeStyleSchema.optional(),
    fill: DrawingFillSchema.optional(),
    fillColor: DrawingColorSchema.optional(),
    roughness: DrawingRoughnessSchema.optional(),
    radius: z.number().nonnegative().optional(),
    points: z.array(pressurePoint).min(1).optional(),
    arrowStart: z.boolean().optional(),
    arrowEnd: z.boolean().optional(),
    text: z.string().optional(),
    size: textSize.optional(),
    font: DrawingFontSchema.optional(),
    align: DrawingAlignSchema.optional()
});
export type DrawingElementPatch = z.infer<typeof DrawingElementPatchSchema>;

/* Elements to add on top, changes by id and ids to take away, in one step. */
export const DrawingEditSchema = z.strictObject({
    add: z.array(NewDrawingElementSchema).optional(),
    update: z.array(DrawingElementPatchSchema).optional(),
    remove: z.array(z.string().min(1)).optional()
});
export type DrawingEdit = z.infer<typeof DrawingEditSchema>;

/* Where an edit went wrong, as the path into the edit and what is wrong there. */
export interface DrawingEditProblem {
    path: (string | number)[];
    message: string;
}

export type DrawingEditOutcome = { ok: true; elements: DrawingElement[]; added: string[] } | { ok: false; problems: DrawingEditProblem[] };

/* Makes the id and the seed of a new element; an id must not be one the drawing already holds. */
export interface DrawingEditMint {
    id(): string;
    seed(): number;
}

function touched(edit: DrawingEdit): number {
    return (edit.add?.length ?? 0) + (edit.update?.length ?? 0) + (edit.remove?.length ?? 0);
}

/* The problems of the ids an update or a remove names: unknown, locked, or named twice. */
function idProblems(byId: ReadonlyMap<string, DrawingElement>, edit: DrawingEdit): DrawingEditProblem[] {
    const problems: DrawingEditProblem[] = [];
    const named = new Set<string>();
    const check = (id: string, path: (string | number)[]): void => {
        const element = byId.get(id);
        if (element === undefined) {
            problems.push({ path, message: `the drawing has no element ${id}` });
        } else if (element.locked === true) {
            problems.push({ path, message: `${id} is locked, so an edit leaves it as it is` });
        } else if (named.has(id)) {
            problems.push({ path, message: `${id} is named twice in this edit` });
        }
        named.add(id);
    };
    edit.update?.forEach((patch, i) => check(patch.id, ['update', i, 'id']));
    edit.remove?.forEach((id, i) => check(id, ['remove', i]));
    return problems;
}

/* The problems of fields a patch sets that its element's kind does not have. */
function kindProblems(byId: ReadonlyMap<string, DrawingElement>, edit: DrawingEdit): DrawingEditProblem[] {
    const shared = new Set(Object.keys(placed));
    return (edit.update ?? []).flatMap((patch, i) => {
        const element = byId.get(patch.id);
        if (element === undefined) {
            return [];
        }
        return Object.keys(patch)
            .filter((key) => key !== 'id' && !shared.has(key) && !KIND_FIELDS[element.kind].includes(key))
            .map((key) => ({ path: ['update', i, key], message: `${patch.id} is a ${element.kind}, which has no field ${key}` }));
    });
}

function created(element: NewDrawingElement, mint: DrawingEditMint): DrawingElement {
    const base = { stroke: 'ink' as const, strokeWidth: 2 as const, ...element, id: mint.id(), seed: mint.seed() };
    return DrawingElementSchema.parse(base.kind === 'text' || base.kind === 'note' ? { size: 20, ...base } : base);
}

/*
 * One edit on the elements of a drawing: the removed ones go, the updated ones change in place and keep
 * their place in the stacking order, and the added ones go on top in the order given. Nothing is applied
 * when any part is wrong, so an edit is one step or none.
 */
export function applyDrawingEdit(elements: readonly DrawingElement[], edit: DrawingEdit, mint: DrawingEditMint): DrawingEditOutcome {
    if (touched(edit) > DRAWING_EDIT_LIMITS.perEdit) {
        return { ok: false, problems: [{ path: [], message: `an edit touches at most ${DRAWING_EDIT_LIMITS.perEdit} elements; split it` }] };
    }
    const byId = new Map(elements.map((element) => [element.id, element]));
    const problems = [...idProblems(byId, edit), ...kindProblems(byId, edit)];
    const patches = new Map((edit.update ?? []).map((patch) => [patch.id, patch]));
    const removed = new Set(edit.remove ?? []);
    const next: DrawingElement[] = [];
    for (const element of elements) {
        if (removed.has(element.id)) {
            continue;
        }
        const patch = patches.get(element.id);
        if (patch === undefined) {
            next.push(element);
            continue;
        }
        const parsed = DrawingElementSchema.safeParse({ ...element, ...patch });
        if (!parsed.success) {
            const index = edit.update!.indexOf(patch);
            problems.push(
                ...parsed.error.issues.map((issue) => ({
                    path: ['update', index, ...issue.path.map((key) => (typeof key === 'number' ? key : String(key)))],
                    message: issue.message
                }))
            );
            continue;
        }
        next.push(parsed.data);
    }
    const added = (edit.add ?? []).map((element) => created(element, mint));
    if (next.length + added.length > DRAWING_EDIT_LIMITS.elements) {
        problems.push({
            path: ['add'],
            message: `a drawing holds at most ${DRAWING_EDIT_LIMITS.elements} elements, and this edit would leave it at ${next.length + added.length}`
        });
    }
    if (problems.length > 0) {
        return { ok: false, problems };
    }
    return { ok: true, elements: [...next, ...added], added: added.map((element) => element.id) };
}
