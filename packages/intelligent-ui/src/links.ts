import { z } from 'zod';
import type { UiLimits } from './budget.ts';
import { isUiComponent, UI_CATALOG } from './catalog.ts';
import type { UiBlock } from './compiler.ts';
import { eachDrawnNode } from './inputs.ts';
import { uiValidatedState } from './query.ts';
import { evaluateUiBlock } from './runtime.ts';

// Open objects: native clients validate a chat whole, so a closed target would fail them on any new optional field.
export const UiLinkTargetSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('File'), path: z.string().min(1).max(4096), line: z.number().int().positive().optional() }),
    z.object({ type: z.literal('Diff'), path: z.string().min(1).max(4096) }),
    z.object({ type: z.literal('Commit'), sha: z.string().regex(/^[a-f\d]{7,64}$/i) }),
    z.object({ type: z.literal('Node'), id: z.string().min(1).max(256) })
]);
export type UiLinkTarget = z.infer<typeof UiLinkTargetSchema>;

// `state` is a frozen set. Native clients validate these payloads whole, so a new state would fail them.
export const UiLinkResolutionSchema = z.object({
    state: z.enum(['chip', 'plain']),
    target: UiLinkTargetSchema.optional(),
    cwd: z.string().optional(),
    viewId: z.string().optional(),
    projectId: z.string().optional(),
    staged: z.boolean().optional(),
    conflicted: z.boolean().optional(),
    relativePath: z.string().optional(),
    label: z.string().optional(),
    // A second line under the label where a link stands as a row, such as the sender and date of a cited message.
    detail: z.string().optional(),
    // A code that names the reason across versions; open, so a new one fails nobody.
    code: z.string().optional(),
    reason: z.string().optional(),
    // What the target is doing, where the host knows: `running`, `needsYou` or `done`. Open, so a later value fails nobody; a client ignores one it does not know.
    status: z.string().optional()
});
export type UiLinkResolution = z.infer<typeof UiLinkResolutionSchema>;

/* How a catalog entry links as another component: the target's type, and for each of its fields the prop that holds it where the names differ. */
type UiLinkAs = string | { readonly type: string; readonly props: Readonly<Record<string, string>> };

/* What a node asks the host to check: its own props under its own name, or those the catalog maps onto the target it links as. */
function linkCandidate(node: { type: string; props: Readonly<Record<string, unknown>> }): Record<string, unknown> {
    // A Source that cites a host node links it as a Node would, so the host checks and opens it the same way.
    if (node.type === 'Source' && typeof node.props.node === 'string') {
        return { type: 'Node', id: node.props.node };
    }

    const entry = isUiComponent(node.type) ? UI_CATALOG[node.type] : undefined;
    // A component the catalog says links as another one, such as a Change as a Diff, is checked and opened as that one.
    const link: UiLinkAs = entry !== undefined && 'link' in entry ? entry.link : node.type;

    if (typeof link === 'string') {
        return { ...node.props, type: link };
    }

    return { ...Object.fromEntries(Object.entries(link.props).map(([field, prop]) => [field, node.props[prop]])), type: link.type };
}

export function uiLinkTargets(
    block: UiBlock,
    input: Readonly<Record<string, unknown>> = {},
    queries: Readonly<Record<string, unknown>> = {},
    limits: Partial<UiLimits> = {}
): Record<string, UiLinkTarget> {
    const state = uiValidatedState(block, input, queries, limits);
    const targets: Record<string, UiLinkTarget> = Object.create(null);

    eachDrawnNode(evaluateUiBlock(block, state, limits).nodes, (node) => {
        const checked = UiLinkTargetSchema.safeParse(linkCandidate(node));

        if (checked.success) {
            targets[node.id] = checked.data;
        }
    });

    return targets;
}
