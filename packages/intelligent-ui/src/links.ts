import { z } from 'zod';
import type { UiLimits } from './budget.ts';
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
    reason: z.string().optional()
});
export type UiLinkResolution = z.infer<typeof UiLinkResolutionSchema>;

export function uiLinkTargets(
    block: UiBlock,
    input: Readonly<Record<string, unknown>> = {},
    queries: Readonly<Record<string, unknown>> = {},
    limits: Partial<UiLimits> = {}
): Record<string, UiLinkTarget> {
    const state = uiValidatedState(block, input, queries, limits);
    const targets: Record<string, UiLinkTarget> = Object.create(null);

    eachDrawnNode(evaluateUiBlock(block, state, limits).nodes, (node) => {
        // A Source that cites a host node links it as a Node would, so the host checks and opens it the same way.
        const candidate =
            node.type === 'Source' && typeof node.props.node === 'string' ? { type: 'Node', id: node.props.node } : { type: node.type, ...node.props };
        const checked = UiLinkTargetSchema.safeParse(candidate);

        if (checked.success) {
            targets[node.id] = checked.data;
        }
    });

    return targets;
}
