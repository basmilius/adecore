import { z } from 'zod';
import type { UiLimits } from './budget.ts';
import type { UiBlock } from './compiler.ts';
import { evaluateUiBlock, type UiViewNode } from './runtime.ts';
import { uiValidatedState } from './query.ts';

export const UiLinkTargetSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('File'), path: z.string().min(1).max(4096), line: z.number().int().positive().optional() }).strict(),
    z.object({ type: z.literal('Diff'), path: z.string().min(1).max(4096) }).strict(),
    z.object({ type: z.literal('Commit'), sha: z.string().regex(/^[a-f\d]{7,64}$/i) }).strict(),
    z.object({ type: z.literal('Node'), id: z.string().min(1).max(256) }).strict()
]);
export type UiLinkTarget = z.infer<typeof UiLinkTargetSchema>;

// `state` is a frozen set: native clients validate these payloads whole, so a new state would fail them.
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
    const visit = (nodes: readonly UiViewNode[]) => {
        for (const node of nodes) {
            if (node.error || !node.complete) {
                continue;
            }
            const checked = UiLinkTargetSchema.safeParse({ type: node.type, ...node.props });
            if (checked.success) {
                targets[node.id] = checked.data;
            }
            visit(node.children);
        }
    };
    visit(evaluateUiBlock(block, state, limits).nodes);
    return targets;
}
